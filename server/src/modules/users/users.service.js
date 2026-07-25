const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const tokenService = require('../../services/token.service');
const emailService = require('../../services/email.service');
const organisationContextService = require('../../services/organisation-context.service');
const logger = require('../../config/logger');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const { sha256, generateToken } = require('../../utils/crypto');

const INVITATION_TTL_DAYS = 7;

async function resolveEmployeeRoleId() {
  const { Role } = require('../../database/models');
  const role = await Role.findOne({ where: { code: 'EMPLOYEE', tenant_id: DEFAULT_TENANT_ID } });
  if (!role) throw ApiError.internal('EMPLOYEE role is not seeded');
  return role.role_id;
}

async function validateDepartmentsExist(nodeIds) {
  // `nodeIds` are member-bearing org_node ids.
  const { OrgNode } = require('../../database/models');
  const { MEMBER_BEARING_NODE_TYPES } = require('../../utils/constants');
  const rows = await OrgNode.findAll({ where: { id: nodeIds }, attributes: ['id', 'node_type'] });
  if (rows.length !== new Set(nodeIds.map(Number)).size) {
    throw ApiError.badRequest('One or more selected org units are invalid');
  }
  const bad = rows.find((r) => !MEMBER_BEARING_NODE_TYPES.includes(r.node_type));
  if (bad) throw ApiError.badRequest(`Members cannot be attached to a ${bad.node_type}`);
}

async function validateOrgNodeOfType(nodeId, expectedType) {
  if (nodeId === null || nodeId === undefined || nodeId === '') return;
  const { OrgNode } = require('../../database/models');
  const allowed = Array.isArray(expectedType) ? expectedType : [expectedType];
  const node = await OrgNode.findByPk(Number(nodeId), { attributes: ['id', 'node_type', 'status'] });
  if (!node || node.status !== 'ACTIVE') {
    throw ApiError.badRequest(`Invalid ${allowed[0].toLowerCase().replace(/_/g, ' ')}`);
  }
  if (!allowed.includes(node.node_type)) {
    throw ApiError.badRequest(`Selected node must be a ${allowed.join(' or ')}`);
  }
}

/**
 * Mirror a set of member-bearing node ids into legacy department_membership for
 * the nodes that map to a legacy department, so department-centric readers keep
 * working. node_membership is written separately (authoritative).
 */
async function mirrorDepartmentMemberships({ userId, nodeIds, primaryNodeId, transaction }) {
  const { DepartmentMembership, OrgNode } = require('../../database/models');
  const nodes = await OrgNode.findAll({
    where: { id: [...new Set(nodeIds.map(Number))] },
    attributes: ['id', 'node_type', 'legacy_ref'],
    transaction,
  });
  const legacyDeptOf = (n) => (n.node_type === 'DEPARTMENT' && n.legacy_ref
    ? Number(n.legacy_ref.split(':')[1]) : null);
  const desiredDeptIds = new Set(nodes.map(legacyDeptOf).filter(Boolean));
  const primaryNode = nodes.find((n) => Number(n.id) === Number(primaryNodeId));
  const primaryDeptId = primaryNode ? legacyDeptOf(primaryNode) : null;

  const existing = await DepartmentMembership.findAll({ where: { user_id: userId }, transaction });
  const existingIds = new Set(existing.map((m) => Number(m.department_id)));
  for (const m of existing) {
    if (!desiredDeptIds.has(Number(m.department_id))) await m.destroy({ transaction });
  }
  for (const deptId of desiredDeptIds) {
    if (!existingIds.has(deptId)) {
      await DepartmentMembership.create({ user_id: userId, department_id: deptId, is_primary: false }, { transaction });
    }
  }
  await DepartmentMembership.update({ is_primary: false }, { where: { user_id: userId }, transaction });
  if (primaryDeptId) {
    await DepartmentMembership.update({ is_primary: true }, { where: { user_id: userId, department_id: primaryDeptId }, transaction });
  }
}

async function validateRoleCategoryExists(roleCategoryId) {
  if (!roleCategoryId) return;
  const { RoleCategory } = require('../../database/models');
  const row = await RoleCategory.findOne({ where: { id: roleCategoryId, tenant_id: DEFAULT_TENANT_ID }, attributes: ['id'] });
  if (!row) throw ApiError.badRequest('role_category_id is invalid');
}

async function validateReportsTo({ reportsToUserId, selfUserId }) {
  if (!reportsToUserId) return;
  if (selfUserId && Number(reportsToUserId) === Number(selfUserId)) {
    throw ApiError.badRequest('A user cannot report to themselves');
  }
  const { UserAccount, PersonProfile } = require('../../database/models');
  const manager = await UserAccount.findOne({ where: { user_id: reportsToUserId }, attributes: ['user_id'] });
  if (!manager) throw ApiError.badRequest('reports_to_user_id is invalid');
  if (!selfUserId) return;
  let cursor = reportsToUserId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (Number(cursor) === Number(selfUserId)) {
      throw ApiError.badRequest('Reporting chain would create a cycle');
    }
    // eslint-disable-next-line no-await-in-loop
    const profile = await PersonProfile.findOne({ where: { user_id: cursor }, attributes: ['reports_to_user_id'] });
    cursor = profile ? profile.reports_to_user_id : null;
  }
}

/**
 * When a role is granted on a member-bearing org node, also attach node_membership
 * (and legacy department_membership when a DEPARTMENT has legacy_ref).
 */
async function attachDepartmentScopeMembership({ userId, scopeId, transaction }) {
  const { MEMBER_BEARING_NODE_TYPES } = require('../../utils/constants');
  const { NodeMembership, DepartmentMembership, OrgNode } = require('../../database/models');
  const node = await OrgNode.findByPk(scopeId, { transaction });
  if (!node || !MEMBER_BEARING_NODE_TYPES.includes(node.node_type)) return;

  await NodeMembership.findOrCreate({
    where: { user_id: userId, node_id: Number(scopeId) },
    defaults: { user_id: userId, node_id: Number(scopeId), is_primary: false },
    transaction,
  });

  if (node.node_type === 'DEPARTMENT' && node.legacy_ref) {
    const deptId = Number(node.legacy_ref.split(':')[1]);
    if (deptId) {
      await DepartmentMembership.findOrCreate({
        where: { user_id: userId, department_id: deptId },
        defaults: { user_id: userId, department_id: deptId, is_primary: false },
        transaction,
      });
    }
  }
}

async function syncDepartmentMemberships({ userId, departmentIds, primaryDepartmentId, transaction }) {
  // `departmentIds` / `primaryDepartmentId` are member-bearing org_node ids.
  const { NodeMembership } = require('../../database/models');
  const desiredIds = new Set(departmentIds.map(Number));
  const primaryId = Number(primaryDepartmentId) || [...desiredIds][0] || null;

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
    await NodeMembership.update({ is_primary: true }, { where: { user_id: userId, node_id: primaryId }, transaction });
  }

  // Keep legacy department_membership in sync for department-centric readers.
  await mirrorDepartmentMemberships({ userId, nodeIds: [...desiredIds], primaryNodeId: primaryId, transaction });
}

async function syncEmployeeRoleAssignments({ userId, roleId, departmentIds, actorUserId, transaction }) {
  const { UserRoleAssignment, OrgNode } = require('../../database/models');
  const nodeIds = [...new Set(departmentIds.map(Number))];
  const nodes = await OrgNode.findAll({ where: { id: nodeIds }, attributes: ['id', 'node_type'], transaction });
  const typeById = new Map(nodes.map((n) => [Number(n.id), n.node_type]));

  await UserRoleAssignment.destroy({ where: { user_id: userId, role_id: roleId }, transaction });
  for (const nodeId of nodeIds) {
    await UserRoleAssignment.create({
      user_id: userId, role_id: roleId, scope_type: typeById.get(nodeId) || 'DEPARTMENT', scope_id: nodeId, assigned_by: actorUserId || null,
    }, { transaction });
  }
}

/** Attach EMPLOYEE + node membership without wiping other memberships/roles. */
async function ensureEmployeeAtNode({ userId, nodeId, actorUserId, transaction }) {
  const { UserRoleAssignment, OrgNode, sequelize } = require('../../database/models');
  const ownTx = !transaction;
  const tx = transaction || await sequelize.transaction();
  try {
    await attachDepartmentScopeMembership({ userId, scopeId: nodeId, transaction: tx });
    const roleId = await resolveEmployeeRoleId();
    const node = await OrgNode.findByPk(nodeId, { attributes: ['id', 'node_type'], transaction: tx });
    if (!node) throw ApiError.badRequest('Org unit is invalid');
    const existing = await UserRoleAssignment.findOne({
      where: {
        user_id: userId,
        role_id: roleId,
        scope_type: node.node_type,
        scope_id: nodeId,
      },
      transaction: tx,
    });
    if (!existing) {
      await UserRoleAssignment.create({
        user_id: userId,
        role_id: roleId,
        scope_type: node.node_type,
        scope_id: nodeId,
        assigned_by: actorUserId || null,
      }, { transaction: tx });
    }
    if (ownTx) await tx.commit();
  } catch (err) {
    if (ownTx) await tx.rollback();
    throw err;
  }
}

async function findAncestorOfTypes(nodeId, types, transaction) {
  const { OrgNode } = require('../../database/models');
  const wanted = new Set(types);
  let current = await OrgNode.findByPk(Number(nodeId), {
    attributes: ['id', 'parent_id', 'node_type'],
    transaction,
  });
  for (let i = 0; i < 40 && current; i += 1) {
    if (wanted.has(current.node_type)) return current;
    if (!current.parent_id) break;
    // eslint-disable-next-line no-await-in-loop
    current = await OrgNode.findByPk(Number(current.parent_id), {
      attributes: ['id', 'parent_id', 'node_type'],
      transaction,
    });
  }
  return null;
}

/** Replace all org memberships + EMPLOYEE scopes with a single node (pencil Company/Office). */
async function replaceOrgAssignmentAtNode({ userId, nodeId, actorUserId, transaction }) {
  const ids = [Number(nodeId)];
  await validateDepartmentsExist(ids);
  await syncDepartmentMemberships({
    userId,
    departmentIds: ids,
    primaryDepartmentId: ids[0],
    transaction,
  });
  const roleId = await resolveEmployeeRoleId();
  await syncEmployeeRoleAssignments({
    userId,
    roleId,
    departmentIds: ids,
    actorUserId,
    transaction,
  });
}

async function syncChatBlocks({ userId, blockedIds, actorUserId, transaction }) {
  const { ChatBlock } = require('../../database/models');
  const desired = Array.from(new Set((blockedIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0 && id !== Number(userId))));
  const existing = await ChatBlock.findAll({ where: { user_id: userId }, attributes: ['blocked_user_id'], transaction });
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
      where: { [Op.or]: [{ user_id: userId, blocked_user_id: toRemove }, { user_id: toRemove, blocked_user_id: userId }] },
      transaction,
    });
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

const SCOPE_LABEL_FALLBACK = 'Organisation-wide';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resolves role + scope labels for the new user's role assignments and
// renders them as an HTML <ul> block consumed by the welcome email template.
async function buildRolesBlockForWelcome(rolesToAssign) {
  if (!Array.isArray(rolesToAssign) || rolesToAssign.length === 0) return '';

  const {
    Role,
    Organisation,
    OfficeLocation,
    Vertical,
    Department,
    OrgNode,
  } = require('../../database/models');

  const roleIds = [...new Set(rolesToAssign.map((r) => r.role_id).filter(Boolean))];

  const grouped = { ORGANISATION: [], OFFICE_LOCATION: [], VERTICAL: [], DEPARTMENT: [] };
  const orgNodeIds = [];
  rolesToAssign.forEach((r) => {
    if (r.scope_type && r.scope_id && grouped[r.scope_type]) {
      grouped[r.scope_type].push(r.scope_id);
    }
    if (r.scope_id) orgNodeIds.push(r.scope_id);
  });

  const [roles, orgs, offices, verticals, departments, orgNodes] = await Promise.all([
    roleIds.length
      ? Role.findAll({ where: { role_id: roleIds }, attributes: ['role_id', 'name'] })
      : [],
    grouped.ORGANISATION.length
      ? Organisation.findAll({ where: { id: grouped.ORGANISATION }, attributes: ['id', 'name'] })
      : [],
    grouped.OFFICE_LOCATION.length
      ? OfficeLocation.findAll({
          where: { id: grouped.OFFICE_LOCATION },
          attributes: ['id', 'name'],
        })
      : [],
    grouped.VERTICAL.length
      ? Vertical.findAll({
          where: { id: grouped.VERTICAL },
          attributes: ['id', 'name'],
          include: [{ model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'] }],
        })
      : [],
    grouped.DEPARTMENT.length
      ? Department.findAll({
          where: { id: grouped.DEPARTMENT },
          attributes: ['id', 'name'],
          include: [{
            model: Vertical, as: 'vertical', attributes: ['id', 'name'],
            include: [{ model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'] }],
          }],
        })
      : [],
    orgNodeIds.length
      ? OrgNode.findAll({ where: { id: [...new Set(orgNodeIds)] }, attributes: ['id', 'name'] })
      : [],
  ]);

  const indexBy = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
  const roleIdx = indexBy(roles, 'role_id');
  const orgIdx = indexBy(orgs, 'id');
  const officeIdx = indexBy(offices, 'id');
  const verticalIdx = indexBy(verticals, 'id');
  const departmentIdx = indexBy(departments, 'id');
  const orgNodeIdx = indexBy(orgNodes, 'id');

  const labelForScope = (scopeType, scopeId) => {
    const fromNode = orgNodeIdx[scopeId]?.name;
    if (['GROUP', 'COMPANY', 'ADMIN_UNIT'].includes(scopeType)) {
      return fromNode || SCOPE_LABEL_FALLBACK;
    }
    switch (scopeType) {
      case 'ORGANISATION': return orgIdx[scopeId]?.name || fromNode || SCOPE_LABEL_FALLBACK;
      case 'OFFICE_LOCATION': return officeIdx[scopeId]?.name || fromNode || SCOPE_LABEL_FALLBACK;
      case 'VERTICAL': {
        const v = verticalIdx[scopeId];
        if (!v) return fromNode || SCOPE_LABEL_FALLBACK;
        return [v.name, v.officeLocation?.name].filter(Boolean).join(' · ');
      }
      case 'DEPARTMENT': {
        const d = departmentIdx[scopeId];
        if (!d) return fromNode || SCOPE_LABEL_FALLBACK;
        return [d.name, d.vertical?.name, d.vertical?.officeLocation?.name].filter(Boolean).join(' · ');
      }
      default: return fromNode || SCOPE_LABEL_FALLBACK;
    }
  };

  const items = rolesToAssign.map((r) => {
    const roleName = roleIdx[r.role_id]?.name || 'Member';
    const scopeLabel = labelForScope(r.scope_type, r.scope_id);
    return `<li style="margin:0 0 4px 0;"><strong>${escapeHtml(roleName)}</strong> &mdash; ${escapeHtml(scopeLabel)}</li>`;
  });

  return `<ul style="margin:0;padding-left:18px;">${items.join('')}</ul>`;
}

// Fires the welcome email after user-create commits. Designed as fire-and-forget:
// any failure is logged but never propagated, so a flaky SMTP doesn't roll back
// a successful account creation.
async function sendWelcomeEmailForNewUser({ newUser, plainPassword, rolesToAssign, actorUserId }) {
  const { UserAccount } = require('../../database/models');

  const [actor, organisation, rolesBlock] = await Promise.all([
    actorUserId ? UserAccount.findByPk(actorUserId, { attributes: ['first_name', 'last_name'] }) : null,
    organisationContextService.getCurrentOrganisation().catch(() => null),
    buildRolesBlockForWelcome(rolesToAssign),
  ]);

  const inviterName = actor
    ? [actor.first_name, actor.last_name].filter(Boolean).join(' ').trim() || 'Your administrator'
    : 'Your administrator';
  const companyName = organisation?.name || null;

  return emailService.sendWelcomeUser({
    to: newUser.email,
    firstName: newUser.first_name,
    email: newUser.email,
    password: plainPassword,
    rolesBlock,
    companyName,
    inviterName,
  });
}

function buildDepartmentPath(department) {
  if (!department) return null;

  const parts = [
    department.name,
    department.vertical?.name,
    department.vertical?.officeLocation?.name,
    department.vertical?.officeLocation?.organisation?.name,
  ].filter(Boolean);

  return parts.join(' · ');
}

const usersService = {
  async list(query) {
    const { QueryTypes } = require('sequelize');
    const {
      UserAccount, PersonProfile, DepartmentMembership, Department, Vertical, OfficeLocation,
      RoleCategory, UserRoleAssignment, Role, sequelize,
    } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);

    const ALLOWED_SORTS = ['name', 'job_title', 'permission', 'created_at'];
    const sortBy  = ALLOWED_SORTS.includes(query.sort_by) ? query.sort_by : 'created_at';
    const sortDir = query.sort_dir === 'asc' ? 'ASC' : 'DESC';

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

    if (query.role_category_rank_lte) {
      conditions.push(
        'EXISTS ('
        + 'SELECT 1 FROM person_profile pp2 '
        + 'JOIN role_category rc2 ON rc2.id = pp2.role_category_id '
        + 'WHERE pp2.user_id = ua.user_id AND rc2.rank <= :roleCategoryRankLte'
        + ')',
      );
      replacements.roleCategoryRankLte = Number(query.role_category_rank_lte);
    }

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

    // Build ORDER BY and optional extra JOIN for the raw ID query
    let extraJoin = '';
    let orderClause;
    const PERM_SUBQUERY = `(SELECT r.name FROM user_role_assignment ura
      JOIN role r ON r.role_id = ura.role_id
      WHERE ura.user_id = ua.user_id
      ORDER BY CASE ura.scope_type
        WHEN 'ORGANISATION' THEN 1 WHEN 'OFFICE_LOCATION' THEN 2
        WHEN 'VERTICAL' THEN 3 ELSE 4 END
      LIMIT 1)`;
    if (sortBy === 'name') {
      orderClause = `LOWER(ua.first_name) ${sortDir}, LOWER(ua.last_name) ${sortDir}`;
    } else if (sortBy === 'job_title') {
      extraJoin = 'LEFT JOIN person_profile pp ON pp.user_id = ua.user_id';
      orderClause = `LOWER(pp.job_title) ${sortDir} NULLS LAST`;
    } else if (sortBy === 'permission') {
      orderClause = `LOWER(${PERM_SUBQUERY}) ${sortDir} NULLS LAST`;
    } else {
      orderClause = `ua.created_at ${sortDir}`;
    }

    const [{ count }] = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM user_account ua WHERE ${whereClause}`,
      { replacements, type: QueryTypes.SELECT },
    );

    const idRows = await sequelize.query(
      `SELECT ua.user_id FROM user_account ua ${extraJoin} WHERE ${whereClause}
         ORDER BY ${orderClause}
         LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    );
    const userIds = idRows.map((row) => row.user_id);

    if (userIds.length === 0) {
      return { users: [], pagination: buildPagination(page, limit, count) };
    }

    // Preserve the exact order from the ID query using CASE WHEN position mapping
    const positionOrder = sequelize.literal(
      `CASE "UserAccount"."user_id" ${userIds.map((id, i) => `WHEN ${id} THEN ${i}`).join(' ')} END`,
    );

    const rows = await UserAccount.findAll({
      where: { user_id: userIds },
      include: [
        {
          model: PersonProfile,
          as: 'profile',
          required: false,
          attributes: [
            'profile_id', 'user_id', 'job_title', 'bio', 'department_display',
            'location', 'date_of_birth', 'date_of_joining', 'employee_id',
            'company_name', 'employee_type', 'company_node_id', 'office_node_id',
            'role_category_id', 'reports_to_user_id',
          ],
          include: [
            { model: RoleCategory, as: 'roleCategory', attributes: ['id', 'name', 'rank'], required: false },
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
              include: [{ model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'], required: false }],
            }],
          }],
        },
        {
          model: UserRoleAssignment,
          as: 'roleAssignments',
          required: false,
          attributes: ['scope_type', 'scope_id'],
          include: [{ model: Role, as: 'role', attributes: ['role_id', 'name', 'code'] }],
        },
      ],
      order: [positionOrder],
    });

    return { users: rows, pagination: buildPagination(page, limit, count) };
  },

  async getById(id) {
    const {
      UserAccount,
      PersonProfile,
      UserRoleAssignment,
      Role,
      RoleCategory,
      DepartmentMembership,
      Department,
      Vertical,
      OfficeLocation,
      Organisation,
      NodeMembership,
      OrgNode,
      UserPermission,
      ModuleAction,
      Module,
      EmployeeInvitation,
      ChatBlock,
    } = require('../../database/models');

    const user = await UserAccount.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
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
          model: UserRoleAssignment,
          as: 'roleAssignments',
          include: [
            { model: Role, as: 'role', attributes: ['role_id', 'name', 'code', 'is_system'] },
          ],
        },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'name', 'code'],
              include: [
                {
                  model: Vertical,
                  as: 'vertical',
                  attributes: ['id', 'name'],
                  include: [
                    {
                      model: OfficeLocation,
                      as: 'officeLocation',
                      attributes: ['id', 'name'],
                      include: [
                        { model: Organisation, as: 'organisation', attributes: ['id', 'name'] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: NodeMembership,
          as: 'nodeMemberships',
          include: [
            {
              model: OrgNode,
              as: 'node',
              attributes: ['id', 'name', 'node_type', 'path', 'legacy_ref'],
            },
          ],
        },
        {
          model: UserPermission,
          as: 'directPermissions',
          include: [{
            model: ModuleAction,
            as: 'moduleAction',
            attributes: ['module_action_id', 'action_code', 'name'],
            include: [{ model: Module, as: 'module', attributes: ['module_id', 'code', 'name'] }],
          }],
        },
      ],
    });

    if (!user) throw ApiError.notFound('User not found');

    const scopedDepartmentIds = new Set();
    (user.roleAssignments || []).forEach((assignment) => {
      if (assignment.scope_type === 'DEPARTMENT' && assignment.scope_id) {
        scopedDepartmentIds.add(Number(assignment.scope_id));
      }
    });
    (user.directPermissions || []).forEach((permission) => {
      if (permission.scope_type === 'DEPARTMENT' && permission.scope_id) {
        scopedDepartmentIds.add(Number(permission.scope_id));
      }
    });

    const existingMemberships = (user.departmentMemberships || []).map((membership) => ({
      ...membership.toJSON(),
      department_id: membership.department_id,
      path: buildDepartmentPath(membership.department),
      source: membership.is_primary ? 'Primary membership' : 'Membership',
    }));

    const existingDepartmentIds = new Set(existingMemberships.map((m) => Number(m.department_id)));
    const seenNodeIds = new Set();

    // Org-tree memberships (authoritative for Entra sync / modern attach)
    (user.nodeMemberships || []).forEach((nm) => {
      const node = nm.node;
      if (!node || node.node_type === 'GROUP') return;
      const nodeId = Number(node.id);
      if (seenNodeIds.has(nodeId)) return;
      seenNodeIds.add(nodeId);

      const legacyDeptId = node.node_type === 'DEPARTMENT' && node.legacy_ref
        ? Number(String(node.legacy_ref).split(':')[1])
        : null;

      if (legacyDeptId && existingDepartmentIds.has(legacyDeptId)) {
        // Enrich the legacy membership with org_node identity for the edit selector.
        const legacyRow = existingMemberships.find((m) => Number(m.department_id) === legacyDeptId);
        if (legacyRow && !legacyRow.node_id) {
          legacyRow.node_id = nodeId;
          legacyRow.node_type = node.node_type;
          if (legacyRow.department) {
            legacyRow.department = {
              ...legacyRow.department,
              org_node_id: nodeId,
              node_type: node.node_type,
            };
          }
        }
        return;
      }

      existingMemberships.push({
        membership_id: `node-${nm.membership_id}`,
        department_id: legacyDeptId || nodeId,
        node_id: nodeId,
        node_type: node.node_type,
        is_primary: Boolean(nm.is_primary),
        joined_at: nm.joined_at || null,
        source: nm.is_primary ? 'Primary membership' : 'Org membership',
        department: {
          id: nodeId,
          name: node.name,
          code: null,
          node_type: node.node_type,
          org_node_id: nodeId,
        },
        path: node.name,
      });
      if (legacyDeptId) existingDepartmentIds.add(legacyDeptId);
    });

    const derivedDepartmentIds = [...scopedDepartmentIds].filter(
      (dId) => !existingDepartmentIds.has(dId) && !seenNodeIds.has(dId)
    );

    if (derivedDepartmentIds.length > 0) {
      const derivedDepartments = await Department.findAll({
        where: { id: derivedDepartmentIds },
        include: [{
          model: Vertical, as: 'vertical', attributes: ['id', 'name'],
          include: [{
            model: OfficeLocation, as: 'officeLocation', attributes: ['id', 'name'],
            include: [{ model: Organisation, as: 'organisation', attributes: ['id', 'name'] }],
          }],
        }],
        order: [['name', 'ASC']],
      });
      derivedDepartments.forEach((department) => {
        existingMemberships.push({
          membership_id: `derived-${department.id}`,
          department_id: department.id,
          is_primary: false,
          joined_at: null,
          source: 'Inherited from scoped assignment',
          department: department.toJSON(),
          path: buildDepartmentPath(department),
        });
      });

      // Remaining ids are org_node DEPARTMENT scopes (not legacy department rows)
      const foundLegacyIds = new Set(derivedDepartments.map((d) => Number(d.id)));
      const missingNodeIds = derivedDepartmentIds.filter((dId) => !foundLegacyIds.has(dId) && !seenNodeIds.has(dId));
      if (missingNodeIds.length > 0) {
        const nodes = await OrgNode.findAll({
          where: { id: missingNodeIds },
          attributes: ['id', 'name', 'node_type'],
        });
        nodes.forEach((node) => {
          if (node.node_type === 'GROUP') return;
          existingMemberships.push({
            membership_id: `scope-node-${node.id}`,
            department_id: node.id,
            is_primary: false,
            joined_at: null,
            source: 'Inherited from scoped assignment',
            department: { id: node.id, name: node.name, code: null },
            path: node.name,
          });
        });
      }
    }

    // Invitation status
    const activeInvitation = await EmployeeInvitation.findOne({
      where: { user_id: id, accepted_at: null, expires_at: { [Op.gt]: new Date() } },
      order: [['created_at', 'DESC']],
    });

    // Chat blocklist
    const blocks = await ChatBlock.findAll({ where: { user_id: id }, attributes: ['blocked_user_id'] });

    const userData = user.toJSON();
    userData.departmentMemberships = existingMemberships;
    userData.invitation_pending = Boolean(activeInvitation);
    userData.invitation_expires_at = activeInvitation?.expires_at || null;
    userData.chat_blocked_user_ids = blocks.map((b) => b.blocked_user_id);
    return userData;
  },

  async create(data, actorUserId) {
    const {
      UserAccount,
      PersonProfile,
      UserRoleAssignment,
      UserPermission,
      DepartmentMembership,
      sequelize,
    } = require('../../database/models');
    const transaction = await sequelize.transaction();

    const plainPassword = data.password && data.password.trim() ? data.password.trim() : null;
    const hasDepartments = Array.isArray(data.department_ids) && data.department_ids.length > 0;
    const hasInitialRoles = (Array.isArray(data.initial_roles) && data.initial_roles.length > 0)
      || Boolean(data.initial_role?.role_id);
    // No password = invitation when the user has membership/role context to attach.
    const isInviteFlow = !plainPassword && (hasDepartments || hasInitialRoles);
    if (!plainPassword && !isInviteFlow) {
      throw ApiError.badRequest('Password is required unless inviting with a department or role assignment');
    }

    try {
      const existing = await UserAccount.findOne({
        where: { email: data.email.toLowerCase() },
        transaction,
      });
      if (existing) throw ApiError.conflict('Email already in use');

      if (Array.isArray(data.department_ids) && data.department_ids.length > 0) {
        await validateDepartmentsExist(data.department_ids);
      }
      if (data.role_category_id) await validateRoleCategoryExists(data.role_category_id);
      if (data.reports_to_user_id) await validateReportsTo({ reportsToUserId: data.reports_to_user_id, selfUserId: null });

      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const passwordHash = isInviteFlow
        ? await bcrypt.hash(crypto.randomBytes(32).toString('hex'), rounds)
        : await bcrypt.hash(plainPassword, rounds);

      const user = await UserAccount.create({
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: data.first_name,
        last_name: data.last_name || null,
        phone: data.phone || null,
        mobile_phone: data.mobile_phone || null,
        azure_object_id: data.azure_object_id || null,
        status: isInviteFlow ? 'INVITED' : 'ACTIVE',
        must_change_password: Boolean(data.must_change_password) && !isInviteFlow,
      }, { transaction });

      // Build profile fields from both data.profile and top-level employee fields
      const profileData = {
        ...(data.profile || {}),
        job_title: data.profile?.job_title || null,
        employee_id: data.profile?.employee_id || null,
        employee_type: data.profile?.employee_type || null,
        company_name: data.profile?.company_name || null,
        company_node_id: data.profile?.company_node_id || null,
        office_node_id: data.profile?.office_node_id || null,
        department_display: data.profile?.department_display || null,
        location: data.profile?.location || null,
        date_of_joining: data.profile?.date_of_joining || null,
        role_category_id: data.role_category_id || null,
        reports_to_user_id: data.reports_to_user_id || null,
      };
      if (profileData.company_node_id) await validateOrgNodeOfType(profileData.company_node_id, ['COMPANY', 'GROUP']);
      if (profileData.office_node_id) await validateOrgNodeOfType(profileData.office_node_id, 'OFFICE_LOCATION');
      await PersonProfile.create({ user_id: user.user_id, ...profileData }, { transaction });
      if (profileData.company_node_id) {
        await ensureEmployeeAtNode({
          userId: user.user_id,
          nodeId: Number(profileData.company_node_id),
          actorUserId,
          transaction,
        });
      }
      if (profileData.office_node_id) {
        await ensureEmployeeAtNode({
          userId: user.user_id,
          nodeId: Number(profileData.office_node_id),
          actorUserId,
          transaction,
        });
      }

      // Employee-style: sync department memberships + EMPLOYEE role assignments
      if (Array.isArray(data.department_ids) && data.department_ids.length > 0) {
        await syncDepartmentMemberships({
          userId: user.user_id,
          departmentIds: data.department_ids,
          primaryDepartmentId: data.primary_department_id,
          transaction,
        });
        const roleId = await resolveEmployeeRoleId();
        await syncEmployeeRoleAssignments({
          userId: user.user_id, roleId, departmentIds: data.department_ids, actorUserId, transaction,
        });
      }

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({ userId: user.user_id, blockedIds: data.chat_blocked_user_ids, actorUserId, transaction });
      }

      // Additional role assignments from initial_roles / initial_role
      const rolesToAssign = data.initial_roles || (data.initial_role ? [data.initial_role] : []);
      for (const role of rolesToAssign) {
        await UserRoleAssignment.create({
          user_id: user.user_id, role_id: role.role_id,
          scope_type: role.scope_type || 'ORGANISATION', scope_id: role.scope_id, assigned_by: actorUserId,
        }, { transaction });
        if (role.scope_id) {
          await attachDepartmentScopeMembership({ userId: user.user_id, scopeId: role.scope_id, transaction });
        }
      }

      if (data.initial_permissions && data.initial_permissions.length > 0) {
        for (const perm of data.initial_permissions) {
          await UserPermission.create({
            user_id: user.user_id, module_action_id: perm.module_action_id,
            effect: 'ALLOW', scope_type: perm.scope_type || 'ORGANISATION', scope_id: perm.scope_id, assigned_by: actorUserId,
          }, { transaction });
        }
      }

      let inviteToken = null;
      let inviteExpiresAt = null;
      if (isInviteFlow) {
        const inv = await createInvitationForUser({ user, invitedByUserId: actorUserId, transaction });
        inviteToken = inv.rawToken;
        inviteExpiresAt = inv.expiresAt;
      }

      await auditService.log({
        user_id: actorUserId,
        action: 'USER_CREATED',
        resource_type: 'UserAccount',
        resource_id: user.user_id,
        details: { email: user.email, invite_flow: isInviteFlow },
      });

      await transaction.commit();

      // Entra sync and other callers set skip_email / source=ENTRA_SYNC — never mail those users.
      const emailDisabled = Boolean(data.skip_email) || data.source === 'ENTRA_SYNC';
      if (!emailDisabled) {
        if (isInviteFlow) {
          const inviter = actorUserId
            ? await UserAccount.findByPk(actorUserId, { attributes: ['first_name', 'last_name'] })
            : null;
          const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : 'An administrator';
          emailService.sendEmployeeInvitation({ to: user.email, firstName: user.first_name, inviterName, token: inviteToken, expiresAt: inviteExpiresAt })
            .catch((err) => logger.warn(`invite email failed for ${user.email}: ${err.message}`));
        } else {
          sendWelcomeEmailForNewUser({ newUser: user, plainPassword, rolesToAssign, actorUserId })
            .catch((err) => logger.warn(`welcome email failed for ${user.email}: ${err.message}`));
        }
      }

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
      if (!user) throw ApiError.notFound('User not found');

      const userFields = ['first_name', 'last_name', 'phone', 'mobile_phone', 'status', 'azure_object_id', 'avatar_url'];
      userFields.forEach((field) => {
        if (data[field] !== undefined) user[field] = data[field];
      });
      await user.save({ transaction });

      // Merge profile fields from data.profile and top-level employee fields
      const profilePatch = { ...(data.profile || {}) };
      if (data.job_title !== undefined) profilePatch.job_title = data.job_title || null;
      if (data.employee_id !== undefined) profilePatch.employee_id = data.employee_id || null;
      if (data.role_category_id !== undefined) profilePatch.role_category_id = data.role_category_id || null;
      if (data.reports_to_user_id !== undefined) profilePatch.reports_to_user_id = data.reports_to_user_id || null;

      const companyNodeIdTouched = Object.prototype.hasOwnProperty.call(profilePatch, 'company_node_id');
      const officeNodeIdTouched = Object.prototype.hasOwnProperty.call(profilePatch, 'office_node_id');

      if (Object.keys(profilePatch).length > 0) {
        if (profilePatch.role_category_id) await validateRoleCategoryExists(profilePatch.role_category_id);
        if (profilePatch.reports_to_user_id) await validateReportsTo({ reportsToUserId: profilePatch.reports_to_user_id, selfUserId: id });
        if (companyNodeIdTouched) {
          profilePatch.company_node_id = profilePatch.company_node_id || null;
          await validateOrgNodeOfType(profilePatch.company_node_id, ['COMPANY', 'GROUP']);
        }
        if (officeNodeIdTouched) {
          profilePatch.office_node_id = profilePatch.office_node_id || null;
          await validateOrgNodeOfType(profilePatch.office_node_id, 'OFFICE_LOCATION');
        }

        // Pencil Company/Office: one linked unit becomes the sole org assignment.
        // Company pick clears office; office pick also sets company from its ancestor.
        if (companyNodeIdTouched && profilePatch.company_node_id && !officeNodeIdTouched) {
          profilePatch.office_node_id = null;
        }
        if (officeNodeIdTouched && profilePatch.office_node_id) {
          const companyAncestor = await findAncestorOfTypes(
            profilePatch.office_node_id,
            ['COMPANY', 'GROUP'],
            transaction,
          );
          if (companyAncestor && !companyNodeIdTouched) {
            profilePatch.company_node_id = companyAncestor.id;
          }
        }

        let profile = await PersonProfile.findOne({ where: { user_id: id }, transaction });
        if (profile) {
          await profile.update(profilePatch, { transaction });
        } else {
          await PersonProfile.create({ user_id: id, ...profilePatch }, { transaction });
          profile = await PersonProfile.findOne({ where: { user_id: id }, transaction });
        }

        // Skip soft-add when department_ids also provided — that path is authoritative.
        const hasDepartmentSync = Array.isArray(data.department_ids) && data.department_ids.length > 0;
        if (!hasDepartmentSync && (companyNodeIdTouched || officeNodeIdTouched)) {
          const officeId = profile?.office_node_id || null;
          const companyId = profile?.company_node_id || null;
          // Prefer the more specific unit when replacing.
          const assignNodeId = officeId || companyId;
          if (assignNodeId) {
            await replaceOrgAssignmentAtNode({
              userId: id,
              nodeId: Number(assignNodeId),
              actorUserId,
              transaction,
            });
          }
        }
      }

      if (Array.isArray(data.department_ids) && data.department_ids.length > 0) {
        await validateDepartmentsExist(data.department_ids);
        await syncDepartmentMemberships({
          userId: id, departmentIds: data.department_ids, primaryDepartmentId: data.primary_department_id, transaction,
        });
        const roleId = await resolveEmployeeRoleId();
        await syncEmployeeRoleAssignments({ userId: id, roleId, departmentIds: data.department_ids, actorUserId, transaction });
      }

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({ userId: id, blockedIds: data.chat_blocked_user_ids, actorUserId, transaction });
      }

      await cacheService.deletePattern(`bh:perm:${id}:*`);
      await cacheService.deletePattern(`bh:perms:${id}:*`);

      await auditService.log({
        user_id: actorUserId,
        action: 'USER_UPDATED',
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

  async deactivate(id, actorUserId) {
    const { UserAccount } = require('../../database/models');

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    // Only suspend access — do NOT set deleted_at so the user remains
    // visible in the admin list under the "Inactive" filter.
    await user.update({ status: 'INACTIVE' });

    // Revoke all tokens
    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'USER_DEACTIVATED',
      resource_type: 'UserAccount',
      resource_id: id,
    });

    return { message: 'User deactivated successfully' };
  },

  async reactivate(id, actorUserId) {
    const { UserAccount } = require('../../database/models');

    // Use unscoped so we can find users that may have deleted_at set (legacy data)
    const user = await UserAccount.unscoped().findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    await user.update({ status: 'ACTIVE', deleted_at: null });

    await auditService.log({
      user_id: actorUserId,
      action: 'USER_REACTIVATED',
      resource_type: 'UserAccount',
      resource_id: id,
    });

    return { message: 'User reactivated successfully' };
  },

  async permanentDelete(id, actorUserId) {
    const { UserAccount } = require('../../database/models');

    // Use unscoped to find even previously soft-deleted users
    const user = await UserAccount.unscoped().findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    // Set deleted_at — this hides the user from all list queries permanently
    await user.update({ status: 'INACTIVE', deleted_at: new Date() });

    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'USER_PERMANENTLY_DELETED',
      resource_type: 'UserAccount',
      resource_id: id,
    });

    return { message: 'User permanently deleted' };
  },

  async assignRole(userId, data, actorUserId) {
    const { UserRoleAssignment, DepartmentMembership } = require('../../database/models');

    // Check for duplicate
    const existing = await UserRoleAssignment.findOne({
      where: {
        user_id: userId,
        role_id: data.role_id,
        scope_type: data.scope_type || 'ORGANISATION',
        scope_id: data.scope_id,
      },
    });
    if (existing) throw ApiError.conflict('Role already assigned at this scope');

    const assignment = await UserRoleAssignment.create({
      user_id: userId,
      role_id: data.role_id,
      scope_type: data.scope_type || 'ORGANISATION',
      scope_id: data.scope_id,
      assigned_by: actorUserId,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
    });

    if (data.scope_id) {
      await attachDepartmentScopeMembership({ userId, scopeId: data.scope_id });
    }

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'ROLE_ASSIGNED',
      resource_type: 'UserRoleAssignment',
      resource_id: assignment.assignment_id,
      details: { target_user_id: userId, role_id: data.role_id },
    });

    return assignment;
  },

  async unassignRole(userId, assignmentId, actorUserId) {
    const { UserRoleAssignment } = require('../../database/models');

    const assignment = await UserRoleAssignment.findByPk(assignmentId);
    if (!assignment) throw ApiError.notFound('Role assignment not found');
    if (Number(assignment.user_id) !== Number(userId)) throw ApiError.badRequest('Assignment does not belong to this user');

    await assignment.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'ROLE_UNASSIGNED',
      resource_type: 'UserRoleAssignment',
      resource_id: assignmentId,
      details: { target_user_id: userId },
    });

    return { message: 'Role unassigned successfully' };
  },

  async assignDirectPermission(userId, data, actorUserId) {
    const { UserPermission } = require('../../database/models');

    const existing = await UserPermission.findOne({
      where: {
        user_id: userId,
        module_action_id: data.module_action_id,
        scope_type: data.scope_type,
        scope_id: data.scope_id,
      },
    });
    if (existing) throw ApiError.conflict('Permission already assigned at this scope');

    const permission = await UserPermission.create({
      user_id: userId,
      module_action_id: data.module_action_id,
      effect: 'ALLOW',
      scope_type: data.scope_type,
      scope_id: data.scope_id,
      assigned_by: actorUserId,
    });

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'PERMISSION_ASSIGNED',
      resource_type: 'UserPermission',
      resource_id: permission.user_permission_id,
      details: { target_user_id: userId, module_action_id: data.module_action_id },
    });

    return permission;
  },

  async removeDirectPermission(userId, permissionId, actorUserId) {
    const { UserPermission } = require('../../database/models');

    const permission = await UserPermission.findByPk(permissionId);
    if (!permission) throw ApiError.notFound('Permission not found');
    if (Number(permission.user_id) !== Number(userId)) throw ApiError.badRequest('Permission does not belong to this user');

    await permission.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'PERMISSION_REMOVED',
      resource_type: 'UserPermission',
      resource_id: permissionId,
      details: { target_user_id: userId },
    });

    return { message: 'Permission removed successfully' };
  },

  async assignDepartment(userId, data, actorUserId) {
    const { DepartmentMembership, sequelize } = require('../../database/models');

    const existing = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: data.department_id },
    });
    if (existing) throw ApiError.conflict('User already assigned to this department');

    // If setting as primary, unset existing primary
    if (data.is_primary) {
      await DepartmentMembership.update(
        { is_primary: false },
        { where: { user_id: userId, is_primary: true } }
      );
    }

    return DepartmentMembership.create({
      user_id: userId,
      department_id: data.department_id,
      is_primary: data.is_primary || false,
    });
  },

  async removeDepartment(userId, deptId) {
    const { DepartmentMembership } = require('../../database/models');

    const membership = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: deptId },
    });
    if (!membership) throw ApiError.notFound('Department membership not found');

    await membership.destroy();
    return { message: 'Removed from department successfully' };
  },

  async resendInvite(id, actorUserId) {
    const { UserAccount, EmployeeInvitation, sequelize } = require('../../database/models');

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound('User not found');
    if (user.status !== 'INVITED') throw ApiError.badRequest('User has already accepted their invitation');

    const transaction = await sequelize.transaction();
    let rawToken;
    let expiresAt;
    try {
      await EmployeeInvitation.update(
        { accepted_at: null, expires_at: new Date() },
        { where: { user_id: id, accepted_at: null, expires_at: { [Op.gt]: new Date() } }, transaction },
      );
      const result = await createInvitationForUser({ user, invitedByUserId: actorUserId, transaction });
      rawToken = result.rawToken;
      expiresAt = result.expiresAt;

      await auditService.log({
        user_id: actorUserId, action: 'USER_INVITE_RESENT', resource_type: 'UserAccount', resource_id: id,
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
    await emailService.sendEmployeeInvitation({ to: user.email, firstName: user.first_name, inviterName, token: rawToken, expiresAt });
    return { message: 'Invitation resent successfully' };
  },

  async listChatCandidates() {
    const { UserAccount, DepartmentMembership, Department } = require('../../database/models');
    const users = await UserAccount.findAll({
      where: { status: 'ACTIVE', deleted_at: null },
      attributes: ['user_id', 'first_name', 'last_name', 'email'],
      include: [{
        model: DepartmentMembership,
        as: 'departmentMemberships',
        required: false,
        include: [{ model: Department, as: 'department', attributes: ['id', 'name'], required: false }],
      }],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    });

    return users.map((u) => {
      const primary = (u.departmentMemberships || []).find((m) => m.is_primary) || (u.departmentMemberships || [])[0];
      return {
        user_id: u.user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        primary_department_name: primary?.department?.name || null,
      };
    });
  },

  async importCsv(rows, actorUserId) {
    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        await this.create({
          ...rows[i],
          scope_type: rows[i].scope_type || 'ORGANISATION',
          scope_id: rows[i].scope_id,
        }, actorUserId);
        results.created++;
      } catch (error) {
        results.skipped++;
        results.errors.push({ row: i + 1, error: error.message });
      }
    }

    return results;
  },

  async getOrgChain(userId) {
    const { sequelize } = require('../../database/models');
    const { QueryTypes } = require('sequelize');

    const fetchNode = async (uid) => {
      const rows = await sequelize.query(
        `SELECT ua.user_id, ua.first_name, ua.last_name, ua.email, ua.status, ua.avatar_url,
                ua.phone, ua.mobile_phone,
                pp.job_title, pp.department_display,
                rc.id AS rc_id, rc.name AS rc_name, rc.rank AS rc_rank
         FROM user_account ua
         LEFT JOIN person_profile pp ON pp.user_id = ua.user_id
         LEFT JOIN role_category rc ON rc.id = pp.role_category_id
         WHERE ua.user_id = :uid AND ua.deleted_at IS NULL`,
        { replacements: { uid }, type: QueryTypes.SELECT },
      );
      if (!rows.length) return null;
      const r = rows[0];
      return {
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email || null,
        status: r.status || null,
        avatar_url: r.avatar_url || null,
        phone: r.phone || null,
        mobile_phone: r.mobile_phone || null,
        job_title: r.job_title || null,
        department_display: r.department_display || null,
        role_category: r.rc_id ? { id: r.rc_id, name: r.rc_name, rank: r.rc_rank } : null,
      };
    };

    const ancestors = [];
    const visited = new Set([userId]);

    const managerRows = await sequelize.query(
      `SELECT pp.reports_to_user_id FROM person_profile pp WHERE pp.user_id = :uid`,
      { replacements: { uid: userId }, type: QueryTypes.SELECT },
    );
    let currentId = managerRows[0]?.reports_to_user_id ?? null;

    while (currentId && !visited.has(currentId) && ancestors.length < 20) {
      visited.add(currentId);
      // eslint-disable-next-line no-await-in-loop
      const node = await fetchNode(currentId);
      if (!node) break;
      ancestors.unshift(node);
      // eslint-disable-next-line no-await-in-loop
      const nextRows = await sequelize.query(
        `SELECT pp.reports_to_user_id FROM person_profile pp WHERE pp.user_id = :uid`,
        { replacements: { uid: currentId }, type: QueryTypes.SELECT },
      );
      currentId = nextRows[0]?.reports_to_user_id ?? null;
    }

    const self = await fetchNode(userId);

    const reportRows = await sequelize.query(
      `SELECT ua.user_id, ua.first_name, ua.last_name, ua.email, ua.status, ua.avatar_url,
              ua.phone, ua.mobile_phone,
              pp.job_title, pp.department_display,
              rc.id AS rc_id, rc.name AS rc_name, rc.rank AS rc_rank
       FROM user_account ua
       LEFT JOIN person_profile pp ON pp.user_id = ua.user_id
       LEFT JOIN role_category rc ON rc.id = pp.role_category_id
       WHERE pp.reports_to_user_id = :userId AND ua.deleted_at IS NULL
       ORDER BY rc.rank NULLS LAST, ua.first_name, ua.last_name`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );

    const direct_reports = reportRows.map((r) => ({
      user_id: r.user_id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email || null,
      status: r.status || null,
      avatar_url: r.avatar_url || null,
      phone: r.phone || null,
      mobile_phone: r.mobile_phone || null,
      job_title: r.job_title || null,
      department_display: r.department_display || null,
      role_category: r.rc_id ? { id: r.rc_id, name: r.rc_name, rank: r.rc_rank } : null,
    }));

    return { ancestors, self, direct_reports };
  },

  /**
   * People-directory projection for any authenticated employee.
   * Omits Azure/HR/admin fields (azure_object_id, hire date, roles, etc.).
   */
  async getDirectoryProfile(id) {
    const {
      UserAccount,
      PersonProfile,
      OrgNode,
    } = require('../../database/models');

    const user = await UserAccount.findByPk(id, {
      attributes: [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'mobile_phone',
        'avatar_url',
        'status',
      ],
      include: [
        {
          model: PersonProfile,
          as: 'profile',
          required: false,
          attributes: [
            'job_title',
            'department_display',
            'company_name',
            'location',
            'company_node_id',
            'office_node_id',
          ],
          include: [
            {
              model: UserAccount,
              as: 'manager',
              attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
              required: false,
            },
            {
              model: OrgNode,
              as: 'companyNode',
              attributes: ['id', 'name', 'node_type'],
              required: false,
            },
            {
              model: OrgNode,
              as: 'officeNode',
              attributes: ['id', 'name', 'node_type'],
              required: false,
            },
          ],
        },
      ],
    });

    if (!user) throw ApiError.notFound('User not found');
    if (user.status === 'INACTIVE') {
      throw ApiError.notFound('User not found');
    }

    const chain = await this.getOrgChain(Number(id));
    const data = user.toJSON();

    return {
      user_id: data.user_id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      mobile_phone: data.mobile_phone || null,
      avatar_url: data.avatar_url || null,
      status: data.status,
      profile: data.profile
        ? {
            job_title: data.profile.job_title || null,
            department_display: data.profile.department_display || null,
            company_name: data.profile.companyNode?.name || data.profile.company_name || null,
            location: data.profile.officeNode?.name || data.profile.location || null,
            companyNode: data.profile.companyNode || null,
            officeNode: data.profile.officeNode || null,
            manager: data.profile.manager || null,
          }
        : null,
      direct_reports: (chain.direct_reports || []).map((r) => ({
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email || null,
        avatar_url: r.avatar_url || null,
        job_title: r.job_title || null,
        department_display: r.department_display || null,
      })),
    };
  },

  ensureEmployeeAtNode,
};

module.exports = usersService;
