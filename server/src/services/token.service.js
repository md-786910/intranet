const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { getRedisClient } = require("../config/redis");
const { sha256, generateToken } = require("../utils/crypto");
const logger = require("../config/logger");

const tokenService = {
  /**
   * Generate a JWT access token.
   * @returns {{ accessToken: string, jti: string }}
   */
  generateAccessToken(payload) {
    const jti = uuidv4();
    const accessToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        jti,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
        issuer: "BrightNow-intranet",
      },
    );
    return { accessToken, jti };
  },

  /**
   * Verify a JWT access token.
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "BrightNow-intranet",
    });
  },

  /**
   * Generate a refresh token (random hex string).
   * @returns {{ refreshToken: string, tokenHash: string }}
   */
  generateRefreshToken() {
    const refreshToken = generateToken(64);
    const tokenHash = sha256(refreshToken);
    return { refreshToken, tokenHash };
  },

  /**
   * Store a refresh token hash in the database.
   */
  async storeRefreshToken({
    userId,
    tokenHash,
    familyId,
    ipAddress,
    userAgent,
  }) {
    const { RefreshToken } = require("../database/models");
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    const ms = parseExpiry(expiresIn);

    await RefreshToken.create({
      user_id: userId,
      token_hash: tokenHash,
      family_id: familyId,
      expires_at: new Date(Date.now() + ms),
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  },

  /**
   * Find a valid (non-revoked, non-expired) refresh token by its hash.
   */
  async findValidRefreshToken(tokenHash) {
    const { RefreshToken } = require("../database/models");
    const { Op } = require("sequelize");

    return RefreshToken.findOne({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });
  },

  /**
   * Find a revoked refresh token by hash (for replay detection).
   */
  async findRevokedRefreshToken(tokenHash) {
    const { RefreshToken } = require("../database/models");

    return RefreshToken.findOne({
      where: {
        token_hash: tokenHash,
        revoked_at: { [require("sequelize").Op.ne]: null },
      },
    });
  },

  /**
   * Revoke a specific refresh token.
   */
  async revokeRefreshToken(tokenId, reason = "TOKEN_ROTATION") {
    const { RefreshToken } = require("../database/models");

    await RefreshToken.update(
      { revoked_at: new Date(), revoked_by: reason },
      { where: { token_id: tokenId } },
    );
  },

  /**
   * Revoke ALL refresh tokens in a family (replay attack response).
   */
  async revokeTokenFamily(familyId, reason = "REPLAY_DETECTED") {
    const { RefreshToken } = require("../database/models");

    await RefreshToken.update(
      { revoked_at: new Date(), revoked_by: reason },
      { where: { family_id: familyId, revoked_at: null } },
    );

    logger.warn(
      `Security: revoked entire token family ${familyId} due to ${reason}`,
    );
  },

  /**
   * Revoke all refresh tokens for a user (password change, account compromise).
   */
  async revokeAllUserTokens(userId, reason = "USER_ACTION") {
    const { RefreshToken } = require("../database/models");

    await RefreshToken.update(
      { revoked_at: new Date(), revoked_by: reason },
      { where: { user_id: userId, revoked_at: null } },
    );
  },

  /**
   * Blacklist an access token JTI in Redis.
   * TTL = remaining time until the access token would have expired.
   */
  async blacklistAccessToken(jti, expiresAt) {
    try {
      const redis = getRedisClient();
      const ttl = Math.max(
        0,
        Math.ceil((expiresAt * 1000 - Date.now()) / 1000),
      );
      if (ttl > 0) {
        await redis.set(`bl:${jti}`, "1", "EX", ttl);
      }
    } catch (err) {
      logger.error("Failed to blacklist access token:", err.message);
    }
  },
};

/**
 * Parse JWT expiry string (e.g., '15m', '7d', '1h') to milliseconds.
 */
function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900000; // Default: 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 900000;
  }
}

module.exports = tokenService;
