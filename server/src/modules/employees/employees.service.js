const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const emailService = require('../../services/email.service');
const { sha256, generateToken } = require('../../utils/crypto');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const INVITATION_TTL_DAYS = 7;

function buildDepartmentPath(department) {
  if (!department) return null;
  return [
    department.name,
    department.vertical?.name,
    department.vertical?.officeLocation?.name,
    department.vertical?.officeLocation?.organisation?.name,
  ].filter(Boolean).join(' · ');
}

function departmentIncludeTree(models) {
  const { Department, Vertical, OfficeLocation, Organisation } = models;
  return {
    model: Department,
    as: 'department',
    attributes: ['id', 'name', 'code'],
    include: [{
      model: Vertical,
      as: 'vertical',
      attributes: ['id', 'name'],
      include: [{
        model: OfficeLocation,
        as: 'officeLocation',
        attributes: ['id', 'name'],
        include: [{
          model: Organisation,
          as: 'organisation',
          attributes: ['id', 'name'],
        }],
      }],
    }],
  };
}

async function resolveEmployeeRoleId() {
  const { Role } = require('../../database/models');
  const role = await Role.findOne({ where: { code: 'EMPLOYEE', tenant_id: DEFAULT_TENANT_ID } });
  if (!role) throw ApiError.internal('EMPLOYEE role is not seeded');
  return role.role_id;
}

async function validateDepartmentsExist(departmentIds) {
  const { Department } = require('../../database/models');
  const rows = await Department.findAll({
    where: { id: departmentIds },
    attributes: ['id'],
  });
  if (rows.length !== new Set(departmentIds).size) {
    throw ApiError.badRequest('One or more department_ids are invalid');
  }
}

async function createInvitationForUser({ user, invitedByUserId, transaction }) {
  const { EmployeeInvitation } = require('../../database/models');
  const rawToken = generateToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await EmployeeInvitation.create({
    tenant_id: DEFAULT_TENANT_ID,
    user_id: user.user_id,
    email: user.email,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by_user_id: invitedByUserId || null,
  }, { transaction });

  return { rawToken, expiresAt };
}

async function syncDepartmentMemberships({ userId, departmentIds, primaryDepartmentId, transaction }) {
  const { DepartmentMembership } = require('../../database/models');

  const existing = await DepartmentMembership.findAll({
    where: { user_id: userId },
    transaction,
  });
  const existingIds = new Set(existing.map((m) => Number(m.department_id)));
  const desiredIds = new Set(departmentIds.map(Number));

  for (const membership of existing) {
    if (!desiredIds.has(Number(membership.department_id))) {
      await membership.destroy({ transaction });
    }
  }

  for (const departmentId of desiredIds) {
    if (!existingIds.has(departmentId)) {
      await DepartmentMembership.create({
        user_id: userId,
        department_id: departmentId,
        is_primary: false,
      }, { transaction });
    }
  }

  const primaryId = primaryDepartmentId || [...desiredIds][0];
  await DepartmentMembership.update(
    { is_primary: false },
    { where: { user_id: userId }, transaction },
  );
  await DepartmentMembership.update(
    { is_primary: true },
    { where: { user_id: userId, department_id: primaryId }, transaction },
  );
}

async function syncEmployeeRoleAssignments({ userId, roleId, departmentIds, actorUserId, transaction }) {
  const { UserRoleAssignment } = require('../../database/models');

  await UserRoleAssignment.destroy({
    where: { user_id: userId, scope_type: 'DEPARTMENT' },
    transaction,
  });

  for (const departmentId of new Set(departmentIds.map(Number))) {
    await UserRoleAssignment.create({
      user_id: userId,
      role_id: roleId,
      scope_type: 'DEPARTMENT',
      scope_id: departmentId,
      assigned_by: actorUserId || null,
    }, { transaction });
  }
}

const employeesService = {
  async list(query) {
    const { QueryTypes } = require('sequelize');
    const {
      UserAccount, PersonProfile, DepartmentMembership, Department, Vertical, OfficeLocation,
      sequelize,
    } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);

    // Build WHERE via EXISTS subqueries instead of INNER JOIN includes — Sequelize's
    // findAndCountAll with nested required hasMany + limit breaks the FROM clause.
    const conditions = ['ua.deleted_at IS NULL'];
    const replacements = { limit, offset };

    if (query.status) {
      conditions.push('ua.status = :status');
      replacements.status = query.status;
    }
    if (query.search) {
      conditions.push('(ua.email ILIKE :search OR ua.first_name ILIKE :search OR ua.last_name ILIKE :search)');
      replacements.search = `%${query.search}%`;
    }

    // Employees = users with at least one invitation row (past or present).
    conditions.push('EXISTS (SELECT 1 FROM employee_invitation ei WHERE ei.user_id = ua.user_id)');

    if (query.department_id || query.vertical_id || query.office_location_id) {
      let orgExists = 'EXISTS (SELECT 1 FROM department_membership dm'
        + ' JOIN department d ON d.id = dm.department_id'
        + ' JOIN vertical v ON v.id = d.vertical_id'
        + ' JOIN office_location ol ON ol.id = v.office_location_id'
        + ' WHERE dm.user_id = ua.user_id';
      if (query.department_id) {
        orgExists += ' AND d.id = :departmentId';
        replacements.departmentId = query.department_id;
      }
      if (query.vertical_id) {
        orgExists += ' AND v.id = :verticalId';
        replacements.verticalId = query.vertical_id;
      }
      if (query.office_location_id) {
        orgExists += ' AND ol.id = :officeLocationId';
        replacements.officeLocationId = query.office_location_id;
      }
      orgExists += ')';
      conditions.push(orgExists);
    }

    const whereClause = conditions.join(' AND ');

    const [{ count }] = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM user_account ua WHERE ${whereClause}`,
      { replacements, type: QueryTypes.SELECT },
    );

    const idRows = await sequelize.query(
      `SELECT ua.user_id FROM user_account ua WHERE ${whereClause}
         ORDER BY ua.first_name ASC, ua.last_name ASC
         LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    );
    const userIds = idRows.map((row) => row.user_id);

    if (userIds.length === 0) {
      return { employees: [], pagination: buildPagination(page, limit, count) };
    }

    const rows = await UserAccount.findAll({
      where: { user_id: userIds },
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          required: false,
          include: [{
            model: Department,
            as: 'department',
            attributes: ['id', 'name'],
            required: false,
            include: [{
              model: Vertical,
              as: 'vertical',
              attributes: ['id', 'name'],
              required: false,
              include: [{
                model: OfficeLocation,
                as: 'officeLocation',
                attributes: ['id', 'name'],
                required: false,
              }],
            }],
          }],
        },
      ],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    });

    return { employees: rows, pagination: buildPagination(page, limit, count) };
  },

  async getById(id) {
    const models = require('../../database/models');
    const { UserAccount, PersonProfile, DepartmentMembership, UserRoleAssignment, Role, EmployeeInvitation } = models;

    const invitationMarker = await EmployeeInvitation.findOne({
      where: { user_id: id },
      attributes: ['invitation_id'],
    });
    if (!invitationMarker) throw ApiError.notFound('Employee not found');

    const user = await UserAccount.findByPk(id, {
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          include: [departmentIncludeTree(models)],
        },
        {
          model: UserRoleAssignment,
          as: 'roleAssignments',
          include: [{ model: Role, as: 'role', attributes: ['role_id', 'name', 'code', 'is_system'] }],
        },
      ],
    });
    if (!user) throw ApiError.notFound('Employee not found');

    const activeInvitation = await EmployeeInvitation.findOne({
      where: {
        user_id: id,
        accepted_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['created_at', 'DESC']],
    });

    const userData = user.toJSON();
    userData.departmentMemberships = (userData.departmentMemberships || []).map((membership) => ({
      ...membership,
      path: buildDepartmentPath(membership.department),
    }));
    userData.invitation_pending = Boolean(activeInvitation);
    userData.invitation_expires_at = activeInvitation?.expires_at || null;
    return userData;
  },

  async create(data, actorUserId) {
    const { UserAccount, PersonProfile, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const email = data.email.toLowerCase();
      const existing = await UserAccount.scope('withDeleted').findOne({
        where: { email },
        transaction,
      });
      if (existing) throw ApiError.conflict('Email already in use');

      await validateDepartmentsExist(data.department_ids);

      // Placeholder password — user sets their own via invitation acceptance
      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), rounds);

      const user = await UserAccount.create({
        email,
        password_hash: placeholderHash,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        status: 'INVITED',
      }, { transaction });

      await PersonProfile.create({
        user_id: user.user_id,
        job_title: data.job_title || null,
        employee_id: data.employee_id || null,
      }, { transaction });

      await syncDepartmentMemberships({
        userId: user.user_id,
        departmentIds: data.department_ids,
        primaryDepartmentId: data.primary_department_id,
        transaction,
      });

      const roleId = await resolveEmployeeRoleId();
      await syncEmployeeRoleAssignments({
        userId: user.user_id,
        roleId,
        departmentIds: data.department_ids,
        actorUserId,
        transaction,
      });

      const { rawToken, expiresAt } = await createInvitationForUser({
        user,
        invitedByUserId: actorUserId,
        transaction,
      });

      await auditService.log({
        user_id: actorUserId,
        action: 'EMPLOYEE_CREATED',
        resource_type: 'UserAccount',
        resource_id: user.user_id,
        details: { email: user.email, department_ids: data.department_ids },
      });

      await transaction.commit();

      // Send email after commit so the row exists before the recipient can click the link
      const inviter = actorUserId
        ? await UserAccount.findByPk(actorUserId, { attributes: ['first_name', 'last_name'] })
        : null;
      const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : 'An administrator';

      await emailService.sendEmployeeInvitation({
        to: user.email,
        firstName: user.first_name,
        inviterName,
        token: rawToken,
        expiresAt,
      });

      return this.getById(user.user_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, actorUserId) {
    const { UserAccount, PersonProfile, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const user = await UserAccount.findByPk(id, { transaction });
      if (!user) throw ApiError.notFound('Employee not found');

      ['first_name', 'last_name', 'phone', 'status'].forEach((field) => {
        if (data[field] !== undefined) user[field] = data[field];
      });
      await user.save({ transaction });

      if (data.job_title !== undefined || data.employee_id !== undefined) {
        let profile = await PersonProfile.findOne({ where: { user_id: id }, transaction });
        const patch = {};
        if (data.job_title !== undefined) patch.job_title = data.job_title || null;
        if (data.employee_id !== undefined) patch.employee_id = data.employee_id || null;
        if (profile) {
          await profile.update(patch, { transaction });
        } else {
          await PersonProfile.create({ user_id: id, ...patch }, { transaction });
        }
      }

      if (Array.isArray(data.department_ids)) {
        await validateDepartmentsExist(data.department_ids);
        await syncDepartmentMemberships({
          userId: id,
          departmentIds: data.department_ids,
          primaryDepartmentId: data.primary_department_id,
          transaction,
        });

        const roleId = await resolveEmployeeRoleId();
        await syncEmployeeRoleAssignments({
          userId: id,
          roleId,
          departmentIds: data.department_ids,
          actorUserId,
          transaction,
        });
      }

      await cacheService.deletePattern(`bh:perm:${id}:*`);
      await cacheService.deletePattern(`bh:perms:${id}:*`);

      await auditService.log({
        user_id: actorUserId,
        action: 'EMPLOYEE_UPDATED',
        resource_type: 'UserAccount',
        resource_id: id,
      });

      await transaction.commit();
      return this.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async softDelete(id, actorUserId) {
    const { UserAccount } = require('../../database/models');

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound('Employee not found');

    await user.update({ status: 'INACTIVE', deleted_at: new Date() });

    const tokenService = require('../../services/token.service');
    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'EMPLOYEE_DEACTIVATED',
      resource_type: 'UserAccount',
      resource_id: id,
    });

    return { message: 'Employee deactivated successfully' };
  },

  async resendInvite(id, actorUserId) {
    const { UserAccount, EmployeeInvitation, sequelize } = require('../../database/models');

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound('Employee not found');
    if (user.status !== 'INVITED') throw ApiError.badRequest('Employee has already accepted their invitation');

    const transaction = await sequelize.transaction();
    let rawToken;
    let expiresAt;
    try {
      // Invalidate any prior pending invitations
      await EmployeeInvitation.update(
        { accepted_at: null, expires_at: new Date() },
        {
          where: { user_id: id, accepted_at: null, expires_at: { [Op.gt]: new Date() } },
          transaction,
        },
      );
      const result = await createInvitationForUser({ user, invitedByUserId: actorUserId, transaction });
      rawToken = result.rawToken;
      expiresAt = result.expiresAt;

      await auditService.log({
        user_id: actorUserId,
        action: 'EMPLOYEE_INVITE_RESENT',
        resource_type: 'UserAccount',
        resource_id: id,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const inviter = actorUserId
      ? await UserAccount.findByPk(actorUserId, { attributes: ['first_name', 'last_name'] })
      : null;
    const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : 'An administrator';

    await emailService.sendEmployeeInvitation({
      to: user.email,
      firstName: user.first_name,
      inviterName,
      token: rawToken,
      expiresAt,
    });

    return { message: 'Invitation resent successfully' };
  },

  async validateInvitation(rawToken) {
    const { EmployeeInvitation, UserAccount } = require('../../database/models');

    const invitation = await EmployeeInvitation.findOne({
      where: {
        token_hash: sha256(rawToken),
        accepted_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      include: [{
        model: UserAccount,
        as: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'email'],
      }],
    });

    if (!invitation) throw new ApiError(410, 'Invitation link is invalid or has expired');

    return {
      email: invitation.email,
      first_name: invitation.user?.first_name || null,
      expires_at: invitation.expires_at,
    };
  },

  async acceptInvitation(rawToken, password, ipAddress, userAgent) {
    const { EmployeeInvitation, UserAccount, sequelize } = require('../../database/models');
    const tokenService = require('../../services/token.service');
    const permissionService = require('../../services/permission.service');
    const { v4: uuidv4 } = require('uuid');

    const transaction = await sequelize.transaction();
    try {
      const invitation = await EmployeeInvitation.findOne({
        where: {
          token_hash: sha256(rawToken),
          accepted_at: null,
          expires_at: { [Op.gt]: new Date() },
        },
        transaction,
      });
      if (!invitation) throw new ApiError(410, 'Invitation link is invalid or has expired');

      const user = await UserAccount.scope('withPassword').findByPk(invitation.user_id, { transaction });
      if (!user) throw ApiError.notFound('User not found');

      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const passwordHash = await bcrypt.hash(password, rounds);

      await user.update({
        password_hash: passwordHash,
        password_changed_at: new Date(),
        status: 'ACTIVE',
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
      }, { transaction });

      await invitation.update({ accepted_at: new Date() }, { transaction });

      await auditService.log({
        user_id: user.user_id,
        action: 'EMPLOYEE_INVITE_ACCEPTED',
        resource_type: 'UserAccount',
        resource_id: user.user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      await transaction.commit();

      const { accessToken } = tokenService.generateAccessToken({
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

      return {
        accessToken,
        refreshToken,
        user: user.toSafeJSON(),
        permissions,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = employeesService;
