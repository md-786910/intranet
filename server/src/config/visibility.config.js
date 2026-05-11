// ─────────────────────────────────────────────────────────────────────────────
// Audience visibility config
// ─────────────────────────────────────────────────────────────────────────────
// Controls which org-hierarchy levels feed a user's effective "audience scope
// keys" when listing news / documents (and any future entity that uses the
// shared audience.service).
//
// Org hierarchy (broadest → narrowest):
//   ORGANISATION  →  OFFICE_LOCATION  →  VERTICAL  →  DEPARTMENT
//
// Why this matters:
//   When admins create news / documents they target a scope (org-wide, an
//   office, a vertical, or a single department). When an employee opens the
//   feed, the server matches the content's target scope against the user's
//   ancestor chain. This config decides which slices of that chain count.
//
// Two ways to configure (per entity):
//
//   1. `audienceLevels` — explicit allow-list. Most expressive.
//        audienceLevels: ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT']
//
//      Examples:
//        ['ORGANISATION']                                   → only org-wide content
//        ['ORGANISATION', 'OFFICE_LOCATION']                → org-wide + same office
//        ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL']    → everything except dept-private
//        ['ORGANISATION', ..., 'DEPARTMENT']                → see everything (default)
//
//   2. `minLevel` — shorthand. The narrowest level included; everything above
//      it is also included.
//        minLevel: 'DEPARTMENT'  → all four levels (most permissive, default)
//        minLevel: 'VERTICAL'    → ORG + OFFICE + VERTICAL  (hide dept-private)
//        minLevel: 'OFFICE_LOCATION' → ORG + OFFICE         (hide vertical & dept)
//        minLevel: 'ORGANISATION'    → org-wide only
//
// Precedence: if both are set, `audienceLevels` wins. If neither is set, the
// service falls back to `minLevel: 'DEPARTMENT'`.
//
// To add a new entity: add a key here and pass that key as the second
// argument to `audienceService.getUserAudienceScopeKeys(userId, '<key>')`.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // News feed (employee-client/src/pages/news, server/src/modules/news)
  news: {
    minLevel: "DEPARTMENT", // ORG + OFFICE + VERTICAL + DEPT
  },

  // Documents library (employee-client/src/pages/documents, server/src/modules/documents)
  documents: {
    minLevel: "DEPARTMENT", // ORG + OFFICE + VERTICAL + DEPT
  },

  // ── Home page widgets ──────────────────────────────────────────────────
  // These don't use `audienceLevels` / `minLevel` (they aren't matching against
  // content audience rules). They use `level` to pick which slice of the
  // hierarchy a logged-in user's "team" is drawn from.
  //
  // 'DEPARTMENT'      → only colleagues in the user's own department(s)
  // 'VERTICAL'        → all departments under the user's vertical
  // 'OFFICE_LOCATION' → all verticals under the user's office
  // 'ORGANISATION'    → everyone
  // ───────────────────────────────────────────────────────────────────────

  // "Key Contacts" card on the home page (employee-client/src/pages/home/MainContentGrid.js)
  keyContacts: {
    level: "ORGANISATION",
  },

  // "Organisation Chart" card on the home page (departments shown to the user)
  homeOrgChart: {
    level: "ORGANISATION",
  },
};
