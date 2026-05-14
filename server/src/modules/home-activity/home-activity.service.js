const { Op } = require('sequelize');
const audienceService = require('../../services/audience.service');
const logger = require('../../config/logger');

const ALLOWED_LEVELS = new Set(['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT']);
const DEFAULT_KINDS = ['NEWS_PUBLISHED', 'DOCUMENT_PUBLISHED', 'ANNOUNCEMENT_PUBLISHED', 'MEMBER_JOINED'];
const DEFAULT_LIMIT = 8;
const DEFAULT_WINDOW_DAYS = 30;

// ── Event-fetch helpers ───────────────────────────────────────────────────

// Returns news articles published within the window AND visible to the
// requesting user under the news visibility config. Maps each match into
// an ActivityRow-shaped event object.
async function fetchPublishedNewsEvents(userId, since) {
  const { NewsItem, ContentAudienceRule } = require('../../database/models');

  const rows = await NewsItem.findAll({
    where: {
      status: 'PUBLISHED',
      published_at: { [Op.gte]: since },
    },
    attributes: ['news_item_id', 'title', 'published_at'],
    include: [{
      model: ContentAudienceRule,
      as: 'audienceRules',
      where: { entity_type: 'NEWS' },
      required: false,
    }],
    order: [['published_at', 'DESC']],
  });

  const userKeys = await audienceService.getUserAudienceScopeKeys(userId, 'news');
  return rows
    .filter((row) => audienceService.matchesAudience(row.audienceRules, userKeys))
    .map((row) => ({
      kind: 'NEWS_PUBLISHED',
      title: 'New article',
      description: row.title,
      timestamp: row.published_at,
      link: `/news/${row.news_item_id}`,
      icon: 'edit_document',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    }));
}

// Announcements published within the window, filtered by audience.
async function fetchPublishedAnnouncementEvents(userId, since) {
  const { AnnouncementItem, ContentAudienceRule } = require('../../database/models');

  const rows = await AnnouncementItem.findAll({
    where: {
      status: 'PUBLISHED',
      published_at: { [Op.gte]: since },
    },
    attributes: ['announcement_item_id', 'title', 'published_at'],
    include: [{
      model: ContentAudienceRule,
      as: 'audienceRules',
      where: { entity_type: 'ANNOUNCEMENT' },
      required: false,
    }],
    order: [['published_at', 'DESC']],
  });

  const userKeys = await audienceService.getUserAudienceScopeKeys(userId, 'announcements');
  return rows
    .filter((row) => audienceService.matchesAudience(row.audienceRules, userKeys))
    .map((row) => ({
      kind: 'ANNOUNCEMENT_PUBLISHED',
      title: 'New announcement',
      description: row.title,
      timestamp: row.published_at,
      link: `/announcements/${row.announcement_item_id}`,
      icon: 'campaign',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    }));
}

// Same shape for documents, against the documents visibility config.
async function fetchPublishedDocumentEvents(userId, since) {
  const { DocumentItem, ContentAudienceRule } = require('../../database/models');

  const rows = await DocumentItem.findAll({
    where: {
      status: 'PUBLISHED',
      published_at: { [Op.gte]: since },
    },
    attributes: ['document_item_id', 'title', 'published_at'],
    include: [{
      model: ContentAudienceRule,
      as: 'audienceRules',
      where: { entity_type: 'DOCUMENT' },
      required: false,
    }],
    order: [['published_at', 'DESC']],
  });

  const userKeys = await audienceService.getUserAudienceScopeKeys(userId, 'documents');
  return rows
    .filter((row) => audienceService.matchesAudience(row.audienceRules, userKeys))
    .map((row) => ({
      kind: 'DOCUMENT_PUBLISHED',
      title: 'New document',
      description: row.title,
      timestamp: row.published_at,
      link: `/documents/${row.document_item_id}`,
      icon: 'description',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    }));
}

// Resolve the set of department_ids that count as the viewer's "team" at the
// configured `level`. Mirrors the slicing pattern used by
// org.service.getMyVertical so the two widgets stay consistent.
async function resolveTeamDepartmentIds(userId, level) {
  const {
    DepartmentMembership, Department, Vertical, OfficeLocation,
  } = require('../../database/models');

  // 1. Find the user's primary department + its full ancestor chain.
  const membership = await DepartmentMembership.findOne({
    where: { user_id: userId },
    order: [['is_primary', 'DESC'], ['joined_at', 'ASC']],
    include: [{
      model: Department,
      as: 'department',
      where: { deleted_at: null },
      required: true,
      include: [{
        model: Vertical,
        as: 'vertical',
        required: true,
        include: [{ model: OfficeLocation, as: 'officeLocation', required: true }],
      }],
    }],
  });

  if (!membership) return null; // user has no department — return null → no member events

  const myDept = membership.department;
  const myVertical = myDept.vertical;
  const myOffice = myVertical.officeLocation;

  // 2. Expand outwards based on `level`.
  if (level === 'DEPARTMENT') {
    return [myDept.id];
  }

  if (level === 'VERTICAL') {
    const departments = await Department.findAll({
      where: { vertical_id: myVertical.id, deleted_at: null },
      attributes: ['id'],
    });
    return departments.map((d) => d.id);
  }

  if (level === 'OFFICE_LOCATION') {
    const verticals = await Vertical.findAll({
      where: { office_location_id: myOffice.id, deleted_at: null },
      attributes: ['id'],
    });
    if (verticals.length === 0) return [];
    const departments = await Department.findAll({
      where: { vertical_id: verticals.map((v) => v.id), deleted_at: null },
      attributes: ['id'],
    });
    return departments.map((d) => d.id);
  }

  // ORGANISATION — null sentinel means "no department filter, all members".
  return null;
}

async function fetchMemberJoinedEvents(userId, since, level) {
  const {
    UserAccount, DepartmentMembership, Department,
  } = require('../../database/models');

  const teamDeptIds = await resolveTeamDepartmentIds(userId, level);
  if (Array.isArray(teamDeptIds) && teamDeptIds.length === 0) return [];

  // Join through department_membership so we only surface users the viewer
  // actually shares a scope with.
  const membershipWhere = teamDeptIds === null
    ? undefined // ORGANISATION level → don't filter by department
    : { department_id: { [Op.in]: teamDeptIds } };

  const newcomers = await UserAccount.findAll({
    where: {
      createdAt: { [Op.gte]: since },
      user_id: { [Op.ne]: userId }, // never show yourself as a "new member"
      status: 'ACTIVE',
    },
    attributes: ['user_id', 'first_name', 'last_name', 'createdAt'],
    include: [{
      model: DepartmentMembership,
      as: 'departmentMemberships',
      where: membershipWhere,
      required: true,
      include: [{
        model: Department,
        as: 'department',
        attributes: ['id', 'name'],
        required: true,
      }],
    }],
    order: [['createdAt', 'DESC']],
  });

  // De-dupe per user (a user with two memberships shouldn't appear twice).
  const seen = new Set();
  const events = [];
  for (const u of newcomers) {
    if (seen.has(u.user_id)) continue;
    seen.add(u.user_id);
    const primary = (u.departmentMemberships || [])[0];
    const deptName = primary?.department?.name || 'a team';
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'A new colleague';
    events.push({
      kind: 'MEMBER_JOINED',
      title: 'New team member',
      description: `${fullName} joined ${deptName}`,
      timestamp: u.createdAt,
      link: null,
      icon: 'person_add',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    });
  }
  return events;
}

// ── Public service ─────────────────────────────────────────────────────────

const homeActivityService = {
  async list(userId) {
    const cfg = require('../../config/visibility.config').recentActivity || {};
    const level = ALLOWED_LEVELS.has(cfg.level) ? cfg.level : 'DEPARTMENT';
    const kinds = new Set(Array.isArray(cfg.kinds) ? cfg.kinds : DEFAULT_KINDS);
    const limit = Number.isInteger(cfg.limit) ? cfg.limit : DEFAULT_LIMIT;
    const windowDays = Number.isInteger(cfg.windowDays) ? cfg.windowDays : DEFAULT_WINDOW_DAYS;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    try {
      const tasks = [];
      if (kinds.has('NEWS_PUBLISHED'))     tasks.push(fetchPublishedNewsEvents(userId, since));
      if (kinds.has('DOCUMENT_PUBLISHED')) tasks.push(fetchPublishedDocumentEvents(userId, since));
      if (kinds.has('ANNOUNCEMENT_PUBLISHED')) tasks.push(fetchPublishedAnnouncementEvents(userId, since));
      if (kinds.has('MEMBER_JOINED'))      tasks.push(fetchMemberJoinedEvents(userId, since, level));

      const events = (await Promise.all(tasks))
        .flat()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      return {
        events,
        scope: { level, kinds: [...kinds], limit, windowDays },
      };
    } catch (err) {
      logger.error(`home-activity list error: ${err.message}`);
      return { events: [], scope: { level, kinds: [...kinds], limit, windowDays } };
    }
  },
};

module.exports = homeActivityService;
