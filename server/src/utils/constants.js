// Scope types for polymorphic hierarchy references.
// Legacy 4-level values are retained (existing rows/enums); GROUP/COMPANY/ADMIN_UNIT
// are the new generic org_node types. scope_id now points at an org_node.id.
const SCOPE_TYPES = {
  ORGANISATION: 'ORGANISATION',
  OFFICE_LOCATION: 'OFFICE_LOCATION',
  VERTICAL: 'VERTICAL',
  DEPARTMENT: 'DEPARTMENT',
  GROUP: 'GROUP',
  COMPANY: 'COMPANY',
  ADMIN_UNIT: 'ADMIN_UNIT',
};

// Generic org_node types. The tree is a single self-referential table; the
// node_type labels a row's role in the tree, kind splits the two branches.
const NODE_TYPES = {
  GROUP: 'GROUP',
  COMPANY: 'COMPANY',
  OFFICE_LOCATION: 'OFFICE_LOCATION',
  VERTICAL: 'VERTICAL',
  DEPARTMENT: 'DEPARTMENT',
  ADMIN_UNIT: 'ADMIN_UNIT',
};

const NODE_KIND = {
  OPERATIONAL: 'OPERATIONAL',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
};

// MEMBER is not a node — it's a node_membership row. It appears in the allowed
// list purely to control where the "Add Member" affordance is offered.
const MEMBER = 'MEMBER';

// Which child node_types may be created under each node_type. Single source of
// truth shared by API validation and (mirrored on) the frontend add menu.
const ALLOWED_CHILDREN = {
  GROUP: ['COMPANY', 'VERTICAL', 'DEPARTMENT', MEMBER],
  COMPANY: ['OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT', MEMBER],
  ADMIN_UNIT: ['VERTICAL', 'DEPARTMENT', MEMBER],
  OFFICE_LOCATION: ['VERTICAL', 'DEPARTMENT', MEMBER],
  VERTICAL: ['DEPARTMENT', MEMBER],
  DEPARTMENT: [MEMBER],
};

// Node types that can hold members (a node_membership can attach here).
const MEMBER_BEARING_NODE_TYPES = Object.keys(ALLOWED_CHILDREN)
  .filter((t) => ALLOWED_CHILDREN[t].includes(MEMBER));

// User account statuses
const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  LOCKED: 'LOCKED',
};

// Org unit statuses
const ORG_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
};

// Permission effect
const PERMISSION_EFFECT = {
  ALLOW: 'ALLOW',
  DENY: 'DENY',
};

// Module codes
const MODULES = {
  NEWS: 'NEWS',
  DOCUMENTS: 'DOCUMENTS',
  PUSH: 'PUSH',
  DIRECTORY: 'DIRECTORY',
  SEARCH: 'SEARCH',
  SAVED: 'SAVED',
  ANALYTICS: 'ANALYTICS',
  ADMIN: 'ADMIN',
};

// Audit log actions
const AUDIT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_UNASSIGNED: 'ROLE_UNASSIGNED',
  ORG_UNIT_CREATED: 'ORG_UNIT_CREATED',
  ORG_UNIT_UPDATED: 'ORG_UNIT_UPDATED',
  ORG_UNIT_DELETED: 'ORG_UNIT_DELETED',
  NEWS_CREATED: 'NEWS_CREATED',
  NEWS_UPDATED: 'NEWS_UPDATED',
  NEWS_DELETED: 'NEWS_DELETED',
  NEWS_PUBLISHED: 'NEWS_PUBLISHED',
  NEWS_ARCHIVED: 'NEWS_ARCHIVED',
  DOC_CREATED: 'DOC_CREATED',
  DOC_UPDATED: 'DOC_UPDATED',
  DOC_DELETED: 'DOC_DELETED',
  DOC_PUBLISHED: 'DOC_PUBLISHED',
  DOC_VERSION_CREATED: 'DOC_VERSION_CREATED',
  PUSH_CREATED: 'PUSH_CREATED',
  PUSH_SENT: 'PUSH_SENT',
  PUSH_CANCELLED: 'PUSH_CANCELLED',
  USER_BULK_IMPORT: 'USER_BULK_IMPORT',
};

// Default tenant ID (used in seeders)
const DEFAULT_TENANT_ID = 1;
const DEFAULT_ORGANISATION_ID = 1;

module.exports = {
  SCOPE_TYPES,
  NODE_TYPES,
  NODE_KIND,
  MEMBER,
  ALLOWED_CHILDREN,
  MEMBER_BEARING_NODE_TYPES,
  USER_STATUS,
  ORG_STATUS,
  PERMISSION_EFFECT,
  MODULES,
  AUDIT_ACTIONS,
  DEFAULT_TENANT_ID,
  DEFAULT_ORGANISATION_ID,
};
