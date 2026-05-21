const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const ApiError = require("../../utils/ApiError");
const auditService = require("../../services/audit.service");
const cacheService = require("../../services/cache.service");
const tokenService = require("../../services/token.service");
const emailService = require("../../services/email.service");
const organisationContextService = require("../../services/organisation-context.service");
const logger = require("../../config/logger");
const { DEFAULT_TENANT_ID } = require("../../utils/constants");
const { parsePagination, buildPagination } = require("../../utils/pagination");
const { sha256, generateToken } = require("../../utils/crypto");

const SCOPE_LABEL_FALLBACK = "Organisation-wide";
const INVITATION_TTL_DAYS = 7;

async function validateRoleCategoryExists(roleCategoryId) {
  if (!roleCategoryId) return;
  const { RoleCategory } = require("../../database/models");
  const row = await RoleCategory.findOne({
    where: { id: roleCategoryId, tenant_id: DEFAULT_TENANT_ID },
    attributes: ["id"],
  });
  if (!row) throw ApiError.badRequest("role_category_id is invalid");
}

async function validateReportsTo({ reportsToUserId, selfUserId }) {
  if (!reportsToUserId) return;
  if (selfUserId && Number(reportsToUserId) === Number(selfUserId)) {
    throw ApiError.badRequest("A user cannot report to themselves");
  }
  const { UserAccount, PersonProfile } = require("../../database/models");
  const manager = await UserAccount.findOne({
    where: { user_id: reportsToUserId },
    attributes: ["user_id"],
  });
  if (!manager) throw ApiError.badRequest("reports_to_user_id is invalid");

  if (!selfUserId) return;
  let cursor = reportsToUserId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (Number(cursor) === Number(selfUserId)) {
      throw ApiError.badRequest("Reporting chain would create a cycle");
    }
    // eslint-disable-next-line no-await-in-loop
    const profile = await PersonProfile.findOne({
      where: { user_id: cursor },
      attributes: ["reports_to_user_id"],
    });
    cursor = profile?.reports_to_user_id || null;
  }
}

async function validateDepartmentsExist(departmentIds) {
  const { Department } = require("../../database/models");
  const rows = await Department.findAll({
    where: { id: departmentIds },
    attributes: ["id"],
  });
  if (rows.length !== new Set(departmentIds).size) {
    throw ApiError.badRequest("One or more department_ids are invalid");
  }
}

async function validateRoleExists(roleId) {
  if (!roleId) return;
  const { Role } = require("../../database/models");
  const row = await Role.findOne({
    where: { role_id: roleId, tenant_id: DEFAULT_TENANT_ID },
    attributes: ["role_id"],
  });
  if (!row) throw ApiError.badRequest("role_id is invalid");
}

async function syncDepartmentMemberships({ userId, departmentIds, primaryDepartmentId, transaction }) {
  const { DepartmentMembership } = require("../../database/models");

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

async function syncManualRoleAssignments({ userId, roleId, departmentIds, actorUserId, transaction }) {
  const { UserRoleAssignment } = require("../../database/models");

  await UserRoleAssignment.destroy({
    where: { user_id: userId, scope_type: "DEPARTMENT" },
    transaction,
  });

  for (const departmentId of new Set(departmentIds.map(Number))) {
    await UserRoleAssignment.create({
      user_id: userId,
      role_id: roleId,
      scope_type: "DEPARTMENT",
      scope_id: departmentId,
      assigned_by: actorUserId || null,
    }, { transaction });
  }
}

async function createInvitationForUser({ user, invitedByUserId, transaction }) {
  const { EmployeeInvitation } = require("../../database/models");
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Resolves role + scope labels for the new user's role assignments and
// renders them as an HTML <ul> block consumed by the welcome email template.
async function buildRolesBlockForWelcome(rolesToAssign) {
  if (!Array.isArray(rolesToAssign) || rolesToAssign.length === 0) return "";

  const {
    Role,
    Organisation,
    OfficeLocation,
    Vertical,
    Department,
  } = require("../../database/models");

  const roleIds = [
    ...new Set(rolesToAssign.map((r) => r.role_id).filter(Boolean)),
  ];

  const grouped = {
    ORGANISATION: [],
    OFFICE_LOCATION: [],
    VERTICAL: [],
    DEPARTMENT: [],
  };
  rolesToAssign.forEach((r) => {
    if (r.scope_type && r.scope_id && grouped[r.scope_type]) {
      grouped[r.scope_type].push(r.scope_id);
    }
  });

  const [roles, orgs, offices, verticals, departments] = await Promise.all([
    roleIds.length
      ? Role.findAll({
          where: { role_id: roleIds },
          attributes: ["role_id", "name"],
        })
      : [],
    grouped.ORGANISATION.length
      ? Organisation.findAll({
          where: { id: grouped.ORGANISATION },
          attributes: ["id", "name"],
        })
      : [],
    grouped.OFFICE_LOCATION.length
      ? OfficeLocation.findAll({
          where: { id: grouped.OFFICE_LOCATION },
          attributes: ["id", "name"],
        })
      : [],
    grouped.VERTICAL.length
      ? Vertical.findAll({
          where: { id: grouped.VERTICAL },
          attributes: ["id", "name"],
          include: [
            {
              model: OfficeLocation,
              as: "officeLocation",
              attributes: ["id", "name"],
            },
          ],
        })
      : [],
    grouped.DEPARTMENT.length
      ? Department.findAll({
          where: { id: grouped.DEPARTMENT },
          attributes: ["id", "name"],
          include: [
            {
              model: Vertical,
              as: "vertical",
              attributes: ["id", "name"],
              include: [
                {
                  model: OfficeLocation,
                  as: "officeLocation",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        })
      : [],
  ]);

  const indexBy = (rows, key) =>
    Object.fromEntries(rows.map((r) => [r[key], r]));
  const roleIdx = indexBy(roles, "role_id");
  const orgIdx = indexBy(orgs, "id");
  const officeIdx = indexBy(offices, "id");
  const verticalIdx = indexBy(verticals, "id");
  const departmentIdx = indexBy(departments, "id");

  const labelForScope = (scopeType, scopeId) => {
    switch (scopeType) {
      case "ORGANISATION":
        return orgIdx[scopeId]?.name || SCOPE_LABEL_FALLBACK;
      case "OFFICE_LOCATION":
        return officeIdx[scopeId]?.name || SCOPE_LABEL_FALLBACK;
      case "VERTICAL": {
        const v = verticalIdx[scopeId];
        if (!v) return SCOPE_LABEL_FALLBACK;
        return [v.name, v.officeLocation?.name].filter(Boolean).join(" · ");
      }
      case "DEPARTMENT": {
        const d = departmentIdx[scopeId];
        if (!d) return SCOPE_LABEL_FALLBACK;
        return [d.name, d.vertical?.name, d.vertical?.officeLocation?.name]
          .filter(Boolean)
          .join(" · ");
      }
      default:
        return SCOPE_LABEL_FALLBACK;
    }
  };

  const items = rolesToAssign.map((r) => {
    const roleName = roleIdx[r.role_id]?.name || "Member";
    const scopeLabel = labelForScope(r.scope_type, r.scope_id);
    return `<li style="margin:0 0 4px 0;"><strong>${escapeHtml(roleName)}</strong> &mdash; ${escapeHtml(scopeLabel)}</li>`;
  });

  return `<ul style="margin:0;padding-left:18px;">${items.join("")}</ul>`;
}

// Fires the welcome email after user-create commits. Designed as fire-and-forget:
// any failure is logged but never propagated, so a flaky SMTP doesn't roll back
// a successful account creation.
async function sendWelcomeEmailForNewUser({
  newUser,
  plainPassword,
  rolesToAssign,
  actorUserId,
}) {
  const { UserAccount } = require("../../database/models");

  const [actor, organisation, rolesBlock] = await Promise.all([
    actorUserId
      ? UserAccount.findByPk(actorUserId, {
          attributes: ["first_name", "last_name"],
        })
      : null,
    organisationContextService.getCurrentOrganisation().catch(() => null),
    buildRolesBlockForWelcome(rolesToAssign),
  ]);

  const inviterName = actor
    ? [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim() ||
      "Your administrator"
    : "Your administrator";
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

async function syncChatBlocks({
  userId,
  blockedIds,
  actorUserId,
  transaction,
}) {
  const { ChatBlock } = require("../../database/models");
  const { Op } = require("sequelize");

  const desired = Array.from(
    new Set(
      (blockedIds || [])
        .map(Number)
        .filter(
          (id) => Number.isInteger(id) && id > 0 && id !== Number(userId),
        ),
    ),
  );

  const existing = await ChatBlock.findAll({
    where: { user_id: userId },
    attributes: ["blocked_user_id"],
    transaction,
  });
  const existingIds = existing.map((row) => row.blocked_user_id);

  const desiredSet = new Set(desired);
  const existingSet = new Set(existingIds);

  const toAdd = desired.filter((id) => !existingSet.has(id));
  const toRemove = existingIds.filter((id) => !desiredSet.has(id));

  for (const otherId of toAdd) {
    // eslint-disable-next-line no-await-in-loop
    await ChatBlock.bulkCreate(
      [
        {
          user_id: userId,
          blocked_user_id: otherId,
          created_by: actorUserId || null,
        },
        {
          user_id: otherId,
          blocked_user_id: userId,
          created_by: actorUserId || null,
        },
      ],
      { transaction, ignoreDuplicates: true },
    );
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

function buildDepartmentPath(department) {
  if (!department) return null;

  const parts = [
    department.name,
    department.vertical?.name,
    department.vertical?.officeLocation?.name,
    department.vertical?.officeLocation?.organisation?.name,
  ].filter(Boolean);

  return parts.join(" · ");
}

const usersService = {
  async list(query) {
    const {
      UserAccount,
      PersonProfile,
      RoleCategory,
      DepartmentMembership,
      Department,
      Vertical,
      OfficeLocation,
      UserRoleAssignment,
      Role,
      sequelize,
    } = require("../../database/models");
    const { Op } = require("sequelize");
    const { page, limit, offset } = parsePagination(query);

    const where = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${query.search}%` } },
        { first_name: { [Op.iLike]: `%${query.search}%` } },
        { last_name: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    // Use EXISTS subqueries for org-hierarchy filters to avoid broken JOIN-based
    // WHERE clauses in Sequelize's findAndCountAll subquery generation.
    const andClauses = [];
    if (query.department_id) {
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM department_membership _dm
         WHERE _dm.user_id = "UserAccount"."user_id"
           AND _dm.department_id = ${Number(query.department_id)}
      )`),
      );
    } else if (query.vertical_id) {
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM department_membership _dm
          JOIN department _d ON _d.id = _dm.department_id
         WHERE _dm.user_id = "UserAccount"."user_id"
           AND _d.vertical_id = ${Number(query.vertical_id)}
      )`),
      );
    } else if (query.office_location_id) {
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM department_membership _dm
          JOIN department _d ON _d.id = _dm.department_id
          JOIN vertical _v  ON _v.id  = _d.vertical_id
         WHERE _dm.user_id = "UserAccount"."user_id"
           AND _v.office_location_id = ${Number(query.office_location_id)}
      )`),
      );
    }
    if (query.role_category_id) {
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM person_profile _pp
         WHERE _pp.user_id = "UserAccount"."user_id"
           AND _pp.role_category_id = ${Number(query.role_category_id)}
      )`),
      );
    }
    if (query.role_id) {
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM user_role_assignment _ura
         WHERE _ura.user_id = "UserAccount"."user_id"
           AND _ura.role_id = ${Number(query.role_id)}
      )`),
      );
    }
    if (query.job_title) {
      const escaped = query.job_title.replace(/'/g, "''");
      andClauses.push(
        sequelize.literal(`EXISTS (
        SELECT 1 FROM person_profile _pp
         WHERE _pp.user_id = "UserAccount"."user_id"
           AND _pp.job_title ILIKE '%${escaped}%'
      )`),
      );
    }
    if (andClauses.length) where[Op.and] = andClauses;

    // PersonProfile: simple belongsTo-style JOIN, fine in main query.
    // DepartmentMemberships / RoleAssignments: hasMany — use separate:true so Sequelize
    // fetches them in follow-up queries keyed by the paginated user IDs.
    // This avoids both the "missing FROM-clause" error from deeply nested JOINs
    // inside Sequelize's pagination subquery AND the LIMIT-on-JOIN-rows problem.
    const include = [
      {
        model: PersonProfile,
        as: "profile",
        required: false,
        include: [
          {
            model: RoleCategory,
            as: "roleCategory",
            attributes: ["id", "name"],
          },
          {
            model: UserAccount,
            as: "manager",
            attributes: ["user_id", "first_name", "last_name", "email"],
          },
        ],
      },
      {
        model: DepartmentMembership,
        as: "departmentMemberships",
        required: false,
        separate: true,
        include: [
          {
            model: Department,
            as: "department",
            attributes: ["id", "name"],
            include: [
              {
                model: Vertical,
                as: "vertical",
                attributes: ["id", "name"],
                include: [
                  {
                    model: OfficeLocation,
                    as: "officeLocation",
                    attributes: ["id", "name"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        model: UserRoleAssignment,
        as: "roleAssignments",
        required: false,
        separate: true,
        include: [
          { model: Role, as: "role", attributes: ["role_id", "name", "code"] },
        ],
      },
    ];

    const sortDir = query.sort_dir === "desc" ? "DESC" : "ASC";
    let order;
    if (query.sort_by === "profession") {
      order = [
        [{ model: PersonProfile, as: "profile" }, "job_title", sortDir],
        ["first_name", "ASC"],
      ];
    } else if (query.sort_by === "status") {
      order = [
        ["status", sortDir],
        ["first_name", "ASC"],
      ];
    } else if (query.sort_by === "created_at") {
      order = [
        ["created_at", sortDir],
        ["first_name", "ASC"],
      ];
    } else {
      order = [
        ["first_name", sortDir],
        ["last_name", sortDir],
      ];
    }

    const { rows, count } = await UserAccount.findAndCountAll({
      where,
      limit,
      offset,
      include,
      order,
    });

    return {
      users: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const {
      UserAccount,
      PersonProfile,
      RoleCategory,
      UserRoleAssignment,
      Role,
      DepartmentMembership,
      Department,
      Vertical,
      OfficeLocation,
      Organisation,
      UserPermission,
      ModuleAction,
      Module,
      ChatBlock,
    } = require("../../database/models");

    const user = await UserAccount.findByPk(id, {
      attributes: { exclude: ["password_hash"] },
      include: [
        {
          model: PersonProfile,
          as: "profile",
          required: false,
          include: [
            {
              model: RoleCategory,
              as: "roleCategory",
              attributes: ["id", "name"],
            },
            {
              model: UserAccount,
              as: "manager",
              attributes: ["user_id", "first_name", "last_name", "email"],
            },
          ],
        },
        {
          model: UserRoleAssignment,
          as: "roleAssignments",
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["role_id", "name", "code", "is_system"],
            },
          ],
        },
        {
          model: DepartmentMembership,
          as: "departmentMemberships",
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name", "code"],
              include: [
                {
                  model: Vertical,
                  as: "vertical",
                  attributes: ["id", "name"],
                  include: [
                    {
                      model: OfficeLocation,
                      as: "officeLocation",
                      attributes: ["id", "name"],
                      include: [
                        {
                          model: Organisation,
                          as: "organisation",
                          attributes: ["id", "name"],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: UserPermission,
          as: "directPermissions",
          include: [
            {
              model: ModuleAction,
              as: "moduleAction",
              attributes: ["module_action_id", "action_code", "name"],
              include: [
                {
                  model: Module,
                  as: "module",
                  attributes: ["module_id", "code", "name"],
                },
              ],
            },
          ],
        },
        {
          model: ChatBlock,
          as: "chatBlocks",
          attributes: ["blocked_user_id"],
          required: false,
        },
      ],
    });

    if (!user) throw ApiError.notFound("User not found");

    const scopedDepartmentIds = new Set();

    (user.roleAssignments || []).forEach((assignment) => {
      if (assignment.scope_type === "DEPARTMENT" && assignment.scope_id) {
        scopedDepartmentIds.add(Number(assignment.scope_id));
      }
    });

    (user.directPermissions || []).forEach((permission) => {
      if (permission.scope_type === "DEPARTMENT" && permission.scope_id) {
        scopedDepartmentIds.add(Number(permission.scope_id));
      }
    });

    const existingMemberships = (user.departmentMemberships || []).map(
      (membership) => ({
        ...membership.toJSON(),
        department_id: membership.department_id,
        path: buildDepartmentPath(membership.department),
        source: membership.is_primary ? "Primary membership" : "Membership",
      }),
    );

    const existingDepartmentIds = new Set(
      existingMemberships.map((membership) => Number(membership.department_id)),
    );
    const derivedDepartmentIds = [...scopedDepartmentIds].filter(
      (departmentId) => !existingDepartmentIds.has(departmentId),
    );

    if (derivedDepartmentIds.length > 0) {
      const derivedDepartments = await Department.findAll({
        where: { id: derivedDepartmentIds },
        include: [
          {
            model: Vertical,
            as: "vertical",
            attributes: ["id", "name"],
            include: [
              {
                model: OfficeLocation,
                as: "officeLocation",
                attributes: ["id", "name"],
                include: [
                  {
                    model: Organisation,
                    as: "organisation",
                    attributes: ["id", "name"],
                  },
                ],
              },
            ],
          },
        ],
        order: [["name", "ASC"]],
      });

      derivedDepartments.forEach((department) => {
        existingMemberships.push({
          membership_id: `derived-${department.id}`,
          department_id: department.id,
          is_primary: false,
          joined_at: null,
          source: "Inherited from scoped assignment",
          department: department.toJSON(),
          path: buildDepartmentPath(department),
        });
      });
    }

    const userData = user.toJSON();
    userData.departmentMemberships = existingMemberships;
    userData.chat_blocked_user_ids = (userData.chatBlocks || []).map(
      (b) => b.blocked_user_id,
    );
    return userData;
  },

  async create(data, actorUserId) {
    const { UserAccount, PersonProfile, sequelize } = require("../../database/models");
    const transaction = await sequelize.transaction();

    const mode = data.mode === "INVITE" ? "INVITE" : "PASSWORD";
    const plainPassword = mode === "PASSWORD" ? data.password : null;

    try {
      const email = data.email.toLowerCase();
      const existing = await UserAccount.scope("withDeleted").findOne({
        where: { email },
        transaction,
      });
      if (existing) throw ApiError.conflict("Email already in use");

      await validateDepartmentsExist(data.department_ids);
      await validateRoleCategoryExists(data.role_category_id);
      await validateRoleExists(data.role_id);
      await validateReportsTo({ reportsToUserId: data.reports_to_user_id, selfUserId: null });

      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const passwordHash = mode === "INVITE"
        ? await bcrypt.hash(crypto.randomBytes(32).toString("hex"), rounds)
        : await bcrypt.hash(plainPassword, rounds);

      const user = await UserAccount.create(
        {
          email,
          password_hash: passwordHash,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          status: mode === "INVITE" ? "INVITED" : "ACTIVE",
        },
        { transaction },
      );

      await PersonProfile.create({
        user_id: user.user_id,
        job_title: data.job_title || null,
        employee_id: data.employee_id || null,
        role_category_id: data.role_category_id || null,
        reports_to_user_id: data.reports_to_user_id || null,
        date_of_joining: data.date_of_joining || null,
        date_of_birth: data.date_of_birth || null,
        location: data.location || null,
        bio: data.bio || null,
      }, { transaction });

      await syncDepartmentMemberships({
        userId: user.user_id,
        departmentIds: data.department_ids,
        primaryDepartmentId: data.primary_department_id,
        transaction,
      });

      if (data.role_id) {
        await syncManualRoleAssignments({
          userId: user.user_id,
          roleId: data.role_id,
          departmentIds: data.department_ids,
          actorUserId,
          transaction,
        });
      }

      if (Array.isArray(data.initial_roles) && data.initial_roles.length > 0) {
        const { UserRoleAssignment } = require("../../database/models");
        for (const role of data.initial_roles) {
          await UserRoleAssignment.findOrCreate({
            where: {
              user_id: user.user_id,
              role_id: role.role_id,
              scope_type: role.scope_type,
              scope_id: role.scope_id,
            },
            defaults: { assigned_by: actorUserId || null },
            transaction,
          });
        }
      }

      if (Array.isArray(data.initial_permissions) && data.initial_permissions.length > 0) {
        const { UserPermission } = require("../../database/models");
        for (const perm of data.initial_permissions) {
          await UserPermission.create({
            user_id: user.user_id,
            module_action_id: perm.module_action_id,
            effect: "ALLOW",
            scope_type: perm.scope_type,
            scope_id: perm.scope_id,
            assigned_by: actorUserId || null,
          }, { transaction });
        }
      }

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({
          userId: user.user_id,
          blockedIds: data.chat_blocked_user_ids,
          actorUserId,
          transaction,
        });
      }

      let invitation = null;
      if (mode === "INVITE") {
        invitation = await createInvitationForUser({
          user,
          invitedByUserId: actorUserId,
          transaction,
        });
      }

      await auditService.log({
        user_id: actorUserId,
        action: "USER_CREATED",
        resource_type: "UserAccount",
        resource_id: user.user_id,
        details: { email: user.email, mode, department_ids: data.department_ids },
      });

      await transaction.commit();

      // Post-commit notifications. SMTP failures must not roll back the user.
      if (mode === "INVITE" && invitation) {
        const inviter = actorUserId
          ? await UserAccount.findByPk(actorUserId, { attributes: ["first_name", "last_name"] })
          : null;
        const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : "An administrator";
        emailService.sendEmployeeInvitation({
          to: user.email,
          firstName: user.first_name,
          inviterName,
          token: invitation.rawToken,
          expiresAt: invitation.expiresAt,
        }).catch((err) => {
          logger.warn(`invitation email failed for ${user.email}: ${err.message}`);
        });
      } else {
        sendWelcomeEmailForNewUser({
          newUser: user,
          plainPassword,
          rolesToAssign: [{ role_id: data.role_id, scope_type: "DEPARTMENT", scope_id: data.department_ids[0] }],
          actorUserId,
        }).catch((err) => {
          logger.warn(`welcome email failed for ${user.email}: ${err.message}`);
        });
      }

      return this.getById(user.user_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, actorUserId) {
    const {
      UserAccount,
      PersonProfile,
      sequelize,
    } = require("../../database/models");
    const transaction = await sequelize.transaction();

    try {
      const user = await UserAccount.findByPk(id, { transaction });
      if (!user) throw ApiError.notFound("User not found");

      // Update user fields
      const userFields = ["first_name", "last_name", "phone", "status"];
      userFields.forEach((field) => {
        if (data[field] !== undefined) user[field] = data[field];
      });
      await user.save({ transaction });

      const profileFieldsTouched = [
        "job_title",
        "role_category_id",
        "reports_to_user_id",
        "date_of_joining",
        "date_of_birth",
        "location",
        "bio",
      ].some((key) => data[key] !== undefined);
      if (profileFieldsTouched) {
        if (
          data.role_category_id !== undefined &&
          data.role_category_id !== null
        ) {
          await validateRoleCategoryExists(data.role_category_id);
        }
        if (
          data.reports_to_user_id !== undefined &&
          data.reports_to_user_id !== null
        ) {
          await validateReportsTo({
            reportsToUserId: data.reports_to_user_id,
            selfUserId: id,
          });
        }
        const profile = await PersonProfile.findOne({
          where: { user_id: id },
          transaction,
        });
        const patch = {};
        if (data.job_title !== undefined)
          patch.job_title = data.job_title || null;
        if (data.role_category_id !== undefined)
          patch.role_category_id = data.role_category_id || null;
        if (data.reports_to_user_id !== undefined)
          patch.reports_to_user_id = data.reports_to_user_id || null;
        if (data.date_of_joining !== undefined)
          patch.date_of_joining = data.date_of_joining || null;
        if (data.date_of_birth !== undefined)
          patch.date_of_birth = data.date_of_birth || null;
        if (data.location !== undefined) patch.location = data.location || null;
        if (data.bio !== undefined) patch.bio = data.bio || null;
        if (profile) {
          await profile.update(patch, { transaction });
        } else {
          await PersonProfile.create(
            { user_id: id, ...patch },
            { transaction },
          );
        }
      }

      if (Array.isArray(data.chat_blocked_user_ids)) {
        await syncChatBlocks({
          userId: Number(id),
          blockedIds: data.chat_blocked_user_ids,
          actorUserId,
          transaction,
        });
      }

      await auditService.log({
        user_id: actorUserId,
        action: "USER_UPDATED",
        resource_type: "UserAccount",
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
    const {
      UserAccount,
      UserRoleAssignment,
      Role,
    } = require("../../database/models");

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound("User not found");

    if (Number(id) === Number(actorUserId))
      throw ApiError.forbidden("You cannot deactivate your own account");

    const ownerAssignment = await UserRoleAssignment.findOne({
      where: { user_id: id },
      include: [
        { model: Role, as: "role", where: { code: "OWNER" }, required: true },
      ],
    });
    if (ownerAssignment)
      throw ApiError.forbidden(
        "The platform owner account cannot be deactivated",
      );

    await user.update({ status: "INACTIVE" });

    // Revoke all tokens
    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: "USER_DEACTIVATED",
      resource_type: "UserAccount",
      resource_id: id,
    });

    return { message: "User deactivated successfully" };
  },

  async reactivate(id, actorUserId) {
    const { UserAccount } = require("../../database/models");

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound("User not found");
    if (user.status !== "INACTIVE")
      throw ApiError.badRequest("User is not inactive");

    await user.update({ status: "ACTIVE", deleted_at: null });

    await auditService.log({
      user_id: actorUserId,
      action: "USER_REACTIVATED",
      resource_type: "UserAccount",
      resource_id: id,
    });

    return { message: "User reactivated successfully" };
  },

  async permanentDelete(id, actorUserId) {
    const {
      UserAccount,
      UserRoleAssignment,
      Role,
    } = require("../../database/models");

    const user = await UserAccount.unscoped().findByPk(id);
    if (!user) throw ApiError.notFound("User not found");
    if (user.status !== "INACTIVE")
      throw ApiError.badRequest(
        "Only inactive users can be permanently deleted",
      );

    const ownerAssignment = await UserRoleAssignment.findOne({
      where: { user_id: id },
      include: [
        { model: Role, as: "role", where: { code: "OWNER" }, required: true },
      ],
    });
    if (ownerAssignment)
      throw ApiError.forbidden("The platform owner account cannot be deleted");

    await auditService.log({
      user_id: actorUserId,
      action: "USER_PERMANENTLY_DELETED",
      resource_type: "UserAccount",
      resource_id: id,
    });

    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);
    await user.destroy();

    return { message: "User permanently deleted" };
  },

  async assignRole(userId, data, actorUserId) {
    const {
      UserRoleAssignment,
      DepartmentMembership,
    } = require("../../database/models");

    // Check for duplicate
    const existing = await UserRoleAssignment.findOne({
      where: {
        user_id: userId,
        role_id: data.role_id,
        scope_type: data.scope_type || "ORGANISATION",
        scope_id: data.scope_id,
      },
    });
    if (existing)
      throw ApiError.conflict("Role already assigned at this scope");

    const assignment = await UserRoleAssignment.create({
      user_id: userId,
      role_id: data.role_id,
      scope_type: data.scope_type || "ORGANISATION",
      scope_id: data.scope_id,
      assigned_by: actorUserId,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
    });

    if (data.scope_type === "DEPARTMENT" && data.scope_id) {
      await DepartmentMembership.findOrCreate({
        where: { user_id: userId, department_id: Number(data.scope_id) },
        defaults: {
          user_id: userId,
          department_id: Number(data.scope_id),
          is_primary: false,
        },
      });
    }

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: "ROLE_ASSIGNED",
      resource_type: "UserRoleAssignment",
      resource_id: assignment.assignment_id,
      details: { target_user_id: userId, role_id: data.role_id },
    });

    return assignment;
  },

  async unassignRole(userId, assignmentId, actorUserId) {
    const { UserRoleAssignment } = require("../../database/models");

    const assignment = await UserRoleAssignment.findByPk(assignmentId);
    if (!assignment) throw ApiError.notFound("Role assignment not found");
    if (Number(assignment.user_id) !== Number(userId))
      throw ApiError.badRequest("Assignment does not belong to this user");

    await assignment.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: "ROLE_UNASSIGNED",
      resource_type: "UserRoleAssignment",
      resource_id: assignmentId,
      details: { target_user_id: userId },
    });

    return { message: "Role unassigned successfully" };
  },

  async assignDirectPermission(userId, data, actorUserId) {
    const { UserPermission } = require("../../database/models");

    const existing = await UserPermission.findOne({
      where: {
        user_id: userId,
        module_action_id: data.module_action_id,
        scope_type: data.scope_type,
        scope_id: data.scope_id,
      },
    });
    if (existing)
      throw ApiError.conflict("Permission already assigned at this scope");

    const permission = await UserPermission.create({
      user_id: userId,
      module_action_id: data.module_action_id,
      effect: "ALLOW",
      scope_type: data.scope_type,
      scope_id: data.scope_id,
      assigned_by: actorUserId,
    });

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: "PERMISSION_ASSIGNED",
      resource_type: "UserPermission",
      resource_id: permission.user_permission_id,
      details: {
        target_user_id: userId,
        module_action_id: data.module_action_id,
      },
    });

    return permission;
  },

  async removeDirectPermission(userId, permissionId, actorUserId) {
    const { UserPermission } = require("../../database/models");

    const permission = await UserPermission.findByPk(permissionId);
    if (!permission) throw ApiError.notFound("Permission not found");
    if (Number(permission.user_id) !== Number(userId))
      throw ApiError.badRequest("Permission does not belong to this user");

    await permission.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: "PERMISSION_REMOVED",
      resource_type: "UserPermission",
      resource_id: permissionId,
      details: { target_user_id: userId },
    });

    return { message: "Permission removed successfully" };
  },

  async assignDepartment(userId, data, actorUserId) {
    const {
      DepartmentMembership,
      sequelize,
    } = require("../../database/models");

    const existing = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: data.department_id },
    });
    if (existing)
      throw ApiError.conflict("User already assigned to this department");

    // If setting as primary, unset existing primary
    if (data.is_primary) {
      await DepartmentMembership.update(
        { is_primary: false },
        { where: { user_id: userId, is_primary: true } },
      );
    }

    return DepartmentMembership.create({
      user_id: userId,
      department_id: data.department_id,
      is_primary: data.is_primary || false,
    });
  },

  async removeDepartment(userId, deptId) {
    const { DepartmentMembership } = require("../../database/models");

    const membership = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: deptId },
    });
    if (!membership) throw ApiError.notFound("Department membership not found");

    await membership.destroy();
    return { message: "Removed from department successfully" };
  },

  async importCsv(rows, actorUserId) {
    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        await this.create(
          {
            ...rows[i],
            scope_type: rows[i].scope_type || "ORGANISATION",
            scope_id: rows[i].scope_id,
          },
          actorUserId,
        );
        results.created++;
      } catch (error) {
        results.skipped++;
        results.errors.push({ row: i + 1, error: error.message });
      }
    }

    return results;
  },
};

module.exports = usersService;
