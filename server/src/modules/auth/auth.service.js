const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const ApiError = require("../../utils/ApiError");
const { sha256, generateToken } = require("../../utils/crypto");
const tokenService = require("../../services/token.service");
const auditService = require("../../services/audit.service");
const permissionService = require("../../services/permission.service");
const emailService = require("../../services/email.service");
const logger = require("../../config/logger");

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MIN = parseInt(process.env.PASSWORD_RESET_TTL_MIN, 10) || 30;

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

    // Update password and clear forced-change flag (e.g. after Entra sync)
    await user.update({
      password_hash: passwordHash,
      password_changed_at: new Date(),
      must_change_password: false,
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
   * Initiate password reset. Always returns successfully to prevent
   * user enumeration. Sends an email only if the account exists & is active.
   */
  async forgotPassword(email, ipAddress, userAgent, client) {
    const { UserAccount, PasswordReset } = require("../../database/models");

    const normalized = email.toLowerCase().trim();
    const user = await UserAccount.findOne({ where: { email: normalized } });

    if (!user || (user.status !== "ACTIVE" && user.status !== "LOCKED")) {
      // Silent no-op so callers can't probe for valid accounts
      logger.info(
        `[auth] forgot-password: skipping (no active user for ${normalized})`,
      );
      return;
    }

    const rawToken = generateToken(32); // 64-char hex
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000);

    await PasswordReset.create({
      user_id: user.user_id,
      email: user.email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    try {
      await emailService.sendPasswordReset({
        to: user.email,
        firstName: user.first_name,
        token: rawToken,
        expiresAt,
        client: client === "admin" ? "admin" : "employee",
      });
    } catch (err) {
      logger.error(`[auth] failed to send password reset email: ${err.message}`);
    }

    await auditService.log({
      user_id: user.user_id,
      action: "PASSWORD_RESET_REQUESTED",
      ip_address: ipAddress,
      user_agent: userAgent,
      result: "SUCCESS",
    });
  },

  /**
   * Validate a password reset token. Returns email + expiry if valid.
   */
  async validatePasswordResetToken(rawToken) {
    const { PasswordReset } = require("../../database/models");
    const tokenHash = sha256(rawToken);

    const reset = await PasswordReset.findOne({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!reset) {
      throw ApiError.notFound("Invalid or expired reset link");
    }

    return { email: reset.email, expires_at: reset.expires_at };
  },

  /**
   * Consume a password reset token and set a new password.
   * Revokes all sessions for the user.
   */
  async resetPassword(rawToken, newPassword) {
    const { UserAccount, PasswordReset, sequelize } = require("../../database/models");
    const tokenHash = sha256(rawToken);

    const reset = await PasswordReset.findOne({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!reset) {
      throw ApiError.notFound("Invalid or expired reset link");
    }

    const user = await UserAccount.findByPk(reset.user_id);
    if (!user) {
      throw ApiError.notFound("Account not found");
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await sequelize.transaction(async (t) => {
      const updates = {
        password_hash: passwordHash,
        password_changed_at: new Date(),
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
      };
      if (user.status === "LOCKED") updates.status = "ACTIVE";
      await user.update(updates, { transaction: t });
      await reset.update({ used_at: new Date() }, { transaction: t });
    });

    await tokenService.revokeAllUserTokens(user.user_id, "PASSWORD_RESET");

    await auditService.log({
      user_id: user.user_id,
      action: "PASSWORD_RESET_COMPLETED",
      result: "SUCCESS",
    });
  },

  /**
   * Get current user profile with permissions and scoped role assignments.
   *
   * `role_assignments` carries the user's `user_role_assignment` rows resolved
   * to human labels so the frontend can lock the audience selector for scoped
   * publishers without re-fetching. `is_owner` is true if any assignment is
   * the system OWNER role.
   */
  async getMe(userId) {
    const {
      UserAccount,
      UserRoleAssignment,
      Role,
      Organisation,
      OfficeLocation,
      Vertical,
      Department,
      OrgNode,
    } = require("../../database/models");

    const user = await UserAccount.findByPk(userId, {
      include: [{ association: "profile" }],
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const permissions = await permissionService.getAllGrantedPermissions(userId);

    const assignments = await UserRoleAssignment.findAll({
      where: {
        user_id: userId,
        [Op.and]: [
          { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
        ],
      },
      include: [{ model: Role, as: 'role', attributes: ['role_id', 'code', 'name', 'is_system'] }],
      attributes: ['assignment_id', 'scope_type', 'scope_id'],
    });

    const groupedIds = { ORGANISATION: [], OFFICE_LOCATION: [], VERTICAL: [], DEPARTMENT: [] };
    const orgNodeIds = [];
    assignments.forEach((a) => {
      if (groupedIds[a.scope_type]) groupedIds[a.scope_type].push(a.scope_id);
      if (a.scope_id) orgNodeIds.push(a.scope_id);
    });

    const [orgs, offices, verticals, departments, orgNodes] = await Promise.all([
      groupedIds.ORGANISATION.length
        ? Organisation.findAll({ where: { id: groupedIds.ORGANISATION }, attributes: ['id', 'name'] })
        : [],
      groupedIds.OFFICE_LOCATION.length
        ? OfficeLocation.findAll({
            where: { id: groupedIds.OFFICE_LOCATION },
            attributes: ['id', 'name'],
            include: [{ model: Organisation, as: 'organisation', attributes: ['id', 'name'] }],
          })
        : [],
      groupedIds.VERTICAL.length
        ? Vertical.findAll({
            where: { id: groupedIds.VERTICAL },
            attributes: ['id', 'name'],
            include: [{
              model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'],
              include: [{ model: Organisation, as: 'organisation', attributes: ['id', 'name'] }],
            }],
          })
        : [],
      groupedIds.DEPARTMENT.length
        ? Department.findAll({
            where: { id: groupedIds.DEPARTMENT },
            attributes: ['id', 'name'],
            include: [{
              model: Vertical, as: 'vertical', attributes: ['id', 'name'],
              include: [{
                model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'],
                include: [{ model: Organisation, as: 'organisation', attributes: ['id', 'name'] }],
              }],
            }],
          })
        : [],
      orgNodeIds.length
        ? OrgNode.findAll({ where: { id: [...new Set(orgNodeIds)] }, attributes: ['id', 'name', 'node_type'] })
        : [],
    ]);

    const indexBy = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const orgIdx = indexBy(orgs);
    const officeIdx = indexBy(offices);
    const verticalIdx = indexBy(verticals);
    const departmentIdx = indexBy(departments);
    const orgNodeIdx = indexBy(orgNodes);

    const labelFromOrgNode = (scopeId) => {
      const node = orgNodeIdx[scopeId];
      return node ? node.name : null;
    };

    const buildLabel = (assignment) => {
      const fromNode = labelFromOrgNode(assignment.scope_id);
      // Org-tree scopes (GROUP/COMPANY/ADMIN_UNIT and modern node ids) resolve via OrgNode.
      if (['GROUP', 'COMPANY', 'ADMIN_UNIT'].includes(assignment.scope_type)) {
        return fromNode;
      }
      switch (assignment.scope_type) {
        case 'ORGANISATION': {
          const o = orgIdx[assignment.scope_id];
          return o ? o.name : fromNode;
        }
        case 'OFFICE_LOCATION': {
          const o = officeIdx[assignment.scope_id];
          return o ? o.name : fromNode;
        }
        case 'VERTICAL': {
          const v = verticalIdx[assignment.scope_id];
          if (!v) return fromNode;
          return [v.name, v.officeLocation?.name].filter(Boolean).join(' · ');
        }
        case 'DEPARTMENT': {
          const d = departmentIdx[assignment.scope_id];
          if (!d) return fromNode;
          return [d.name, d.vertical?.name, d.vertical?.officeLocation?.name].filter(Boolean).join(' · ');
        }
        default:
          return fromNode;
      }
    };

    const role_assignments = assignments.map((a) => ({
      assignment_id: a.assignment_id,
      scope_type: a.scope_type,
      scope_id: a.scope_id,
      scope_label: buildLabel(a),
      role: a.role ? {
        role_id: a.role.role_id,
        code: a.role.code,
        name: a.role.name,
        is_system: a.role.is_system,
      } : null,
    }));

    const is_owner = role_assignments.some((a) => a.role?.code === 'OWNER');

    return {
      user: user.toSafeJSON(),
      permissions,
      role_assignments,
      is_owner,
    };
  },

  /**
   * Update current user profile info.
   */
  async updateProfile(userId, updateData) {
    const { UserAccount } = require("../../database/models");

    const user = await UserAccount.findByPk(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Only allow updating specific fields
    const allowedUpdates = {
      first_name: updateData.first_name,
      last_name: updateData.last_name,
      phone: updateData.phone,
    };

    await user.update(allowedUpdates);

    await auditService.log({
      user_id: userId,
      action: "PROFILE_UPDATED",
      result: "SUCCESS",
    });

    return user.toSafeJSON();
  },
};

module.exports = authService;
