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

async function validateDepartmentsExist(nodeIds) {
  // `nodeIds` are org_node ids (member-bearing nodes). Retained function name
  // for its callers; validates existence + that members may attach there.
  const { OrgNode } = require('../../database/models');
  const { MEMBER_BEARING_NODE_TYPES } = require('../../utils/constants');
  const rows = await OrgNode.findAll({
    where: { id: nodeIds },
    attributes: ['id', 'node_type'],
  });
  if (rows.length !== new Set(nodeIds.map(Number)).size) {
    throw ApiError.badRequest('One or more selected org units are invalid');
  }
  const bad = rows.find((r) => !MEMBER_BEARING_NODE_TYPES.includes(r.node_type));
  if (bad) {
    throw ApiError.badRequest(`Members cannot be attached to a ${bad.node_type}`);
  }
}

async function validateRoleCategoryExists(roleCategoryId) {
  if (!roleCategoryId) return;
  const { RoleCategory } = require('../../database/models');
  const row = await RoleCategory.findOne({
    where: { id: roleCategoryId, tenant_id: DEFAULT_TENANT_ID },
    attributes: ['id'],
  });
  if (!row) throw ApiError.badRequest('role_category_id is invalid');
}

async function validateReportsTo({ reportsToUserId, selfUserId }) {
  if (!reportsToUserId) return;
  if (selfUserId && Number(reportsToUserId) === Number(selfUserId)) {
    throw ApiError.badRequest('An employee cannot report to themselves');
  }
  const { UserAccount, PersonProfile } = require('../../database/models');
  const manager = await UserAccount.findOne({
    where: { user_id: reportsToUserId },
    attributes: ['user_id'],
  });
  if (!manager) throw ApiError.badRequest('reports_to_user_id is invalid');

  // Cycle detection: walking up the manager chain from `reportsToUserId`
  // must never land back on `selfUserId`. Capped to 50 hops as a safety net.
  if (!selfUserId) return;
  let cursor = reportsToUserId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (Number(cursor) === Number(selfUserId)) {
      throw ApiError.badRequest('Reporting chain would create a cycle');
    }
    // eslint-disable-next-line no-await-in-loop
    const profile = await PersonProfile.findOne({
      where: { user_id: cursor },
      attributes: ['reports_to_user_id'],
    });
    cursor = profile ? profile.reports_to_user_id : null;
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
  // `departmentIds` / `primaryDepartmentId` are org_node ids (member-bearing).
  // Primary source of truth is node_membership. For nodes that map to a legacy
  // department we ALSO mirror department_membership so existing department-centric
  // readers keep working during the transition.
  const { NodeMembership, DepartmentMembership, OrgNode } = require('../../database/models');

  const desiredIds = new Set(departmentIds.map(Number));
  const primaryId = Number(primaryDepartmentId) || [...desiredIds][0] || null;

  // ── node_membership (authoritative) ──
  const existing = await NodeMembership.findAll({ where: { user_id: userId }, transaction });
  const existingIds = new Set(existing.map((m) => Number(m.node_id)));
  for (const membership of existing) {
    if (!desiredIds.has(Number(membership.node_id))) await membership.destroy({ transaction });
  }
  for (const nodeId of desiredIds) {
    if (!existingIds.has(nodeId)) {
      await NodeMembership.create({ user_id: userId, node_id: nodeId, is_primary: false }, { transaction });
    }
  }
  await NodeMembership.update({ is_primary: false }, { where: { user_id: userId }, transaction });
  if (primaryId) {
    await NodeMembership.update(
      { is_primary: true },
      { where: { user_id: userId, node_id: primaryId }, transaction },
    );
  }

  // ── department_membership mirror (legacy readers) ──
  const nodes = await OrgNode.findAll({
    where: { id: [...desiredIds] },
    attributes: ['id', 'node_type', 'legacy_ref'],
    transaction,
  });
  const legacyDeptOf = (n) => (n.node_type === 'DEPARTMENT' && n.legacy_ref
    ? Number(n.legacy_ref.split(':')[1]) : null);
  const desiredDeptIds = new Set(nodes.map(legacyDeptOf).filter(Boolean));
  const primaryNode = nodes.find((n) => Number(n.id) === primaryId);
  const primaryDeptId = primaryNode ? legacyDeptOf(primaryNode) : null;

  const existingDept = await DepartmentMembership.findAll({ where: { user_id: userId }, transaction });
  const existingDeptIds = new Set(existingDept.map((m) => Number(m.department_id)));
  for (const m of existingDept) {
    if (!desiredDeptIds.has(Number(m.department_id))) await m.destroy({ transaction });
  }
  for (const deptId of desiredDeptIds) {
    if (!existingDeptIds.has(deptId)) {
      await DepartmentMembership.create({ user_id: userId, department_id: deptId, is_primary: false }, { transaction });
    }
  }
  await DepartmentMembership.update({ is_primary: false }, { where: { user_id: userId }, transaction });
  if (primaryDeptId) {
    await DepartmentMembership.update(
      { is_primary: true },
      { where: { user_id: userId, department_id: primaryDeptId }, transaction },
    );
  }
}

async function syncEmployeeRoleAssignments({ userId, roleId, departmentIds, actorUserId, transaction }) {
  // Assign the EMPLOYEE role at each selected node (scope_id = org_node id).
  const { UserRoleAssignment, OrgNode } = require('../../database/models');

  const nodeIds = [...new Set(departmentIds.map(Number))];
  const nodes = await OrgNode.findAll({ where: { id: nodeIds }, attributes: ['id', 'node_type'], transaction });
  const typeById = new Map(nodes.map((n) => [Number(n.id), n.node_type]));

  // Clear any prior auto-assigned employee-role rows for this user/role.
  await UserRoleAssignment.destroy({
    where: { user_id: userId, role_id: roleId },
    transaction,
  });

  for (const nodeId of nodeIds) {
    await UserRoleAssignment.create({
      user_id: userId,
      role_id: roleId,
      scope_type: typeById.get(nodeId) || 'DEPARTMENT',
      scope_id: nodeId,
      assigned_by: actorUserId || null,
    }, { transaction });
  }
}

// Reconciles the bidirectional chat blocklist for `userId` to match the
// admin-provided list. Each block is stored as two rows so the chat search
// can exclude with a single-direction subquery. Self-blocks are ignored.
async function syncChatBlocks({ userId, blockedIds, actorUserId, transaction }) {
  const { ChatBlock } = require('../../database/models');

  const desired = Array.from(new Set((blockedIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0 && id !== Number(userId))));

  const existing = await ChatBlock.findAll({
    where: { user_id: userId },
    attributes: ['blocked_user_id'],
    transaction,
  });
  const existingIds = existing.map((row) => row.blocked_user_id);

  const desiredSet = new Set(desired);
  const existingSet = new Set(existingIds);

  const toAdd = desired.filter((id) => !existingSet.has(id));
  const toRemove = existingIds.filter((id) => !desiredSet.has(id));

  for (const otherId of toAdd) {
    await ChatBlock.bulkCreate([
      { user_id: userId, blocked_user_id: otherId, created_by: actorUserId || null },
      { user_id: otherId, blocked_user_id: userId, created_by: actorUserId || null },
    ], { transaction, ignoreDuplicates: true });
  }

  if (toRemove.length > 0) {
    await ChatBlock.destroy({
      where: {
        [Op.or]: [
          { user_id: userId, blocked_user_id: toRemove },
          { user_id: toRemove, blocked_user_id: userId },
        ],
      },
      transaction,
    });
  }
}

const employeesService = {
  async list(query) {
    const { QueryTypes } = require('sequelize');
    const {
      UserAccount, PersonProfile, DepartmentMembership, Department, Vertical, OfficeLocation,
      RoleCategory, sequelize,
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

    const { appendOrgNodeMembershipFilter } = require('../../utils/orgNodeListFilter');
    appendOrgNodeMembershipFilter(conditions, replacements, query);

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
        {
          model: PersonProfile,
          as: 'profile',
          required: false,
          include: [
            { model: RoleCategory, as: 'roleCategory', attributes: ['id', 'name', 'rank'], required: false },
            { model: UserAccount, as: 'manager', attributes: ['user_id', 'first_name', 'last_name'], required: false },
          ],
        },
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
    const {
      UserAccount, PersonProfile, DepartmentMembership, UserRoleAssignment,
      Role, RoleCategory, EmployeeInvitation, OrgNode,
    } = models;

    const invitationMarker = await EmployeeInvitation.findOne({
      where: { user_id: id },
      attributes: ['invitation_id'],
    });
    if (!invitationMarker) throw ApiError.notFound('Employee not found');

    const user = await UserAccount.findByPk(id, {
      include: [
        {
          model: PersonProfile,
          as: 'profile',
          required: false,
          include: [
            { model: RoleCategory, as: 'roleCategory', attributes: ['id', 'name', 'rank'], required: false },
            { model: UserAccount, as: 'manager', attributes: ['user_id', 'first_name', 'last_name', 'email'], required: false },
            { model: OrgNode, as: 'companyNode', attributes: ['id', 'name', 'node_type'], required: false },
            { model: OrgNode, as: 'officeNode', attributes: ['id', 'name', 'node_type'], required: false },
          ],
        },
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

    // Hydrate the chat blocklist so the Employee Edit page can render the
    // ChatAccessSelector with current state.
    const { ChatBlock } = require('../../database/models');
    const blocks = await ChatBlock.findAll({
      where: { user_id: id },
      attributes: ['blocked_user_id'],
    });
    userData.chat_blocked_user_ids = blocks.map((b) => b.blocked_user_id);

    return userData;
  },

  // Returns the pool used by the ChatAccessSelector on the admin Create/Edit
  // employee pages — every ACTIVE user in the tenant with their primary
  // department name for context.
  async listChatCandidates() {
    const { UserAccount, DepartmentMembership, Department } = require('../../database/models');
    const users = await UserAccount.findAll({
      where: { status: 'ACTIVE', deleted_at: null },
      attributes: ['user_id', 'first_name', 'last_name', 'email'],
      include: [{
        model: DepartmentMembership,
        as: 'departmentMemberships',
        required: false,
        include: [{
          model: Department,
          as: 'department',
          attributes: ['id', 'name'],
          required: false,
        }],
      }],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    });

    return users.map((u) => {
      const primary = (u.departmentMemberships || []).find((m) => m.is_primary)
        || (u.departmentMemberships || [])[0];
      return {
        user_id: u.user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        primary_department_name: primary?.department?.name || null,
      };
    });
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
      await validateRoleCategoryExists(data.role_category_id);
      await validateReportsTo({ reportsToUserId: data.reports_to_user_id, selfUserId: null });

      // Placeholder password — user sets their own via invitation acceptance
      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), rounds);

      const user = await UserAccount.create({
        email,
        password_hash: placeholderHash,
        first_name: data.first_name,
        last_name: data.last_name || null,
        phone: data.phone || null,
        status: 'INVITED',
      }, { transaction });

      await PersonProfile.create({
        user_id: user.user_id,
        job_title: data.job_title || null,
        employee_id: data.employee_id || null,
        role_category_id: data.role_category_id || null,
        reports_to_user_id: data.reports_to_user_id || null,
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

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({
          userId: user.user_id,
          blockedIds: data.chat_blocked_user_ids,
          actorUserId,
          transaction,
        });
      }

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

      const profileFieldsTouched = ['job_title', 'employee_id', 'role_category_id', 'reports_to_user_id']
        .some((key) => data[key] !== undefined);
      if (profileFieldsTouched) {
        if (data.role_category_id !== undefined && data.role_category_id !== null) {
          await validateRoleCategoryExists(data.role_category_id);
        }
        if (data.reports_to_user_id !== undefined && data.reports_to_user_id !== null) {
          await validateReportsTo({ reportsToUserId: data.reports_to_user_id, selfUserId: id });
        }
        const profile = await PersonProfile.findOne({ where: { user_id: id }, transaction });
        const patch = {};
        if (data.job_title !== undefined) patch.job_title = data.job_title || null;
        if (data.employee_id !== undefined) patch.employee_id = data.employee_id || null;
        if (data.role_category_id !== undefined) patch.role_category_id = data.role_category_id || null;
        if (data.reports_to_user_id !== undefined) patch.reports_to_user_id = data.reports_to_user_id || null;
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

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({
          userId: id,
          blockedIds: data.chat_blocked_user_ids,
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
