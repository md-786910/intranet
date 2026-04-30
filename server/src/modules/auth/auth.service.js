const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const ApiError = require("../../utils/ApiError");
const { sha256 } = require("../../utils/crypto");
const tokenService = require("../../services/token.service");
const auditService = require("../../services/audit.service");
const permissionService = require("../../services/permission.service");
const logger = require("../../config/logger");

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;

const authService = {
  /**
   * Authenticate user with email and password.
   * Returns tokens and user profile on success.
   *
   * Security:
   * - Generic "Invalid credentials" on all failures (no user enumeration)
   * - Account lockout after 5 failed attempts
   * - bcrypt for constant-time comparison
   */
  async login(email, password, ipAddress, userAgent) {
    const { UserAccount } = require("../../database/models");

    // Find user with password (default scope excludes password_hash)
    const user = await UserAccount.scope('withPassword').findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Generic error — don't reveal if email exists
      throw ApiError.unauthorized("Invalid credentials");
    }

    // Check account status
    if (user.status === "INACTIVE") {
      throw ApiError.unauthorized("Invalid credentials");
    }
    if (user.status === "INVITED") {
      throw ApiError.unauthorized("Account not activated. Please use the invitation link sent to your email.");
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 60000,
      );
      throw ApiError.tooManyRequests(
        `Account temporarily locked. Try again in ${minutesLeft} minutes`,
      );
    }

    // Verify password (bcrypt handles constant-time comparison)
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      // Increment failed attempts
      const attempts = user.failed_login_attempts + 1;
      const updateData = { failed_login_attempts: attempts };

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        updateData.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
        updateData.status = "LOCKED";
        logger.warn(
          `Account locked: ${user.email} after ${attempts} failed attempts`,
        );
      }

      await user.update(updateData);

      await auditService.log({
        user_id: user.user_id,
        action: "USER_LOGIN_FAILED",
        details: { attempts, locked: attempts >= MAX_FAILED_ATTEMPTS },
        ip_address: ipAddress,
        user_agent: userAgent,
        result: "FAILURE",
      });

      throw ApiError.unauthorized("Invalid credentials");
    }

    // Success: reset failed attempts, update last login
    await user.update({
      failed_login_attempts: 0,
      locked_until: null,
      status: "ACTIVE",
      last_login_at: new Date(),
    });

    // Generate tokens
    const { accessToken, jti } = tokenService.generateAccessToken({
      userId: user.user_id,
      email: user.email,
    });

    const familyId = uuidv4();
    const { refreshToken, tokenHash } = tokenService.generateRefreshToken();

    await tokenService.storeRefreshToken({
      userId: user.user_id,
      tokenHash,
      familyId,
      ipAddress,
      userAgent,
    });

    const permissions = await permissionService.getAllGrantedPermissions(user.user_id);

    await auditService.log({
      user_id: user.user_id,
      action: "USER_LOGIN",
      ip_address: ipAddress,
      user_agent: userAgent,
      result: "SUCCESS",
    });

    return {
      accessToken,
      refreshToken,
      user: user.toSafeJSON(),
      permissions,
    };
  },

  /**
   * Refresh access token using a valid refresh token.
   *
   * Security:
   * - Token rotation: old refresh token is revoked on use
   * - Replay detection: if a rotated-out token is reused, revoke entire family
   */
  async refresh(refreshTokenValue, ipAddress, userAgent) {
    const tokenHash = sha256(refreshTokenValue);

    // Look for valid (non-revoked, non-expired) token
    const storedToken = await tokenService.findValidRefreshToken(tokenHash);

    if (!storedToken) {
      // Check if this is a replay attack (token was already used/revoked)
      const revokedToken =
        await tokenService.findRevokedRefreshToken(tokenHash);

      if (revokedToken) {
        // REPLAY DETECTED: revoke entire family
        await tokenService.revokeTokenFamily(
          revokedToken.family_id,
          "REPLAY_DETECTED",
        );

        await auditService.log({
          user_id: revokedToken.user_id,
          action: "TOKEN_REPLAY_DETECTED",
          details: { family_id: revokedToken.family_id },
          ip_address: ipAddress,
          user_agent: userAgent,
          result: "SECURITY_EVENT",
        });

        logger.warn(
          `Replay attack detected for user ${revokedToken.user_id}, family ${revokedToken.family_id}`,
        );
      }

      throw ApiError.unauthorized("Invalid refresh token");
    }

    // Revoke the current refresh token (rotation)
    await tokenService.revokeRefreshToken(
      storedToken.token_id,
      "TOKEN_ROTATION",
    );

    // Issue new token pair (same family)
    const { UserAccount } = require("../../database/models");
    const user = await UserAccount.findByPk(storedToken.user_id);

    if (!user || user.status !== "ACTIVE") {
      throw ApiError.unauthorized("Account is not active");
    }

    const { accessToken } = tokenService.generateAccessToken({
      userId: user.user_id,
      email: user.email,
    });

    const { refreshToken: newRefreshToken, tokenHash: newTokenHash } =
      tokenService.generateRefreshToken();

    await tokenService.storeRefreshToken({
      userId: user.user_id,
      tokenHash: newTokenHash,
      familyId: storedToken.family_id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  /**
   * Logout: blacklist access token and revoke refresh token.
   */
  async logout(userId, jti, tokenExp, refreshTokenValue) {
    // Blacklist the access token in Redis
    if (jti && tokenExp) {
      await tokenService.blacklistAccessToken(jti, tokenExp);
    }

    // Revoke refresh token if provided
    if (refreshTokenValue) {
      const tokenHash = sha256(refreshTokenValue);
      const storedToken = await tokenService.findValidRefreshToken(tokenHash);
      if (storedToken) {
        await tokenService.revokeRefreshToken(
          storedToken.token_id,
          "USER_LOGOUT",
        );
      }
    }
  },

  /**
   * Change password: verify current, hash new, revoke all sessions.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const { UserAccount } = require("../../database/models");

    const user = await UserAccount.scope("withPassword").findByPk(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw ApiError.unauthorized("Current password is incorrect");
    }

    // Hash new password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    // Update password
    await user.update({
      password_hash: passwordHash,
      password_changed_at: new Date(),
    });

    // Revoke ALL refresh tokens (force re-login everywhere)
    await tokenService.revokeAllUserTokens(userId, "PASSWORD_CHANGE");

    await auditService.log({
      user_id: userId,
      action: "PASSWORD_CHANGE",
      result: "SUCCESS",
    });
  },

  /**
   * Get current user profile with permissions.
   */
  async getMe(userId) {
    const { UserAccount } = require("../../database/models");

    const user = await UserAccount.findByPk(userId, {
      include: [{ association: "profile" }],
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const permissions = await permissionService.getAllGrantedPermissions(userId);

    return {
      user: user.toSafeJSON(),
      permissions,
    };
  },
};

module.exports = authService;
