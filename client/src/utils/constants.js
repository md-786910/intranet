export const NODE_TYPES = {
  GROUP: 'GROUP',
  COMPANY: 'COMPANY',
  ORGANISATION: 'ORGANISATION',
  OFFICE_LOCATION: 'OFFICE_LOCATION',
  VERTICAL: 'VERTICAL',
  DEPARTMENT: 'DEPARTMENT',
  ADMIN_UNIT: 'ADMIN_UNIT',
};

export const NODE_TYPE_LABELS = {
  GROUP: 'Group',
  COMPANY: 'Company',
  ORGANISATION: 'Organisation',
  OFFICE_LOCATION: 'Office Location',
  VERTICAL: 'Vertical',
  DEPARTMENT: 'Department',
  ADMIN_UNIT: 'Administrative Unit',
};

// MEMBER is not a node — it flags where the "Add Member" affordance appears.
export const MEMBER = 'MEMBER';

// Which child node types may be created under each node type. Mirrors the
// server-side ALLOWED_CHILDREN policy so the add menu and API agree.
export const ALLOWED_CHILDREN = {
  GROUP: ['COMPANY', 'VERTICAL', 'DEPARTMENT', MEMBER],
  ORGANISATION: ['COMPANY', 'VERTICAL', 'DEPARTMENT', MEMBER],
  COMPANY: ['OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT', MEMBER],
  ADMIN_UNIT: ['VERTICAL', 'DEPARTMENT', MEMBER],
  OFFICE_LOCATION: ['VERTICAL', 'DEPARTMENT', MEMBER],
  VERTICAL: ['DEPARTMENT', MEMBER],
  DEPARTMENT: [MEMBER],
};

export const ADD_CHILD_LABELS = {
  COMPANY: 'Company',
  ADMIN_UNIT: 'Administrative Unit',
  OFFICE_LOCATION: 'Office Location',
  VERTICAL: 'Vertical',
  DEPARTMENT: 'Department',
  MEMBER: 'Member',
};

export const MEMBER_BEARING_NODE_TYPES = Object.keys(ALLOWED_CHILDREN)
  .filter((t) => ALLOWED_CHILDREN[t].includes(MEMBER));

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  LOCKED: 'LOCKED',
};

export const CONTENT_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
};

export const STATUS_VARIANTS = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  LOCKED: 'danger',
  INVITED: 'info',
  DRAFT: 'default',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
  SENT: 'success',
  SCHEDULED: 'info',
  CANCELLED: 'danger',
};

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50];
