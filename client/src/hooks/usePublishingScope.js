import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useCurrentOrganisation } from './useCurrentOrganisation';
import { useOrgTree } from './useOrgTree';

const SCOPE_RANK = {
  DEPARTMENT: 4,
  ADMIN_UNIT: 4,
  VERTICAL: 3,
  OFFICE_LOCATION: 2,
  COMPANY: 2,
  ORGANISATION: 1,
  GROUP: 1,
};

const ORG_WIDE_TYPES = new Set(['ORGANISATION', 'GROUP']);
const PUBLISH_ANYWHERE_ROLES = new Set(['CONTENT_EDITOR', 'OFFICE_MANAGER', 'OWNER']);

function pickNarrowest(assignments) {
  if (!assignments.length) return null;
  return [...assignments].sort(
    (a, b) => (SCOPE_RANK[b.scope_type] || 0) - (SCOPE_RANK[a.scope_type] || 0),
  )[0];
}

function toAudienceTarget(assignment) {
  return {
    scope_type: assignment.scope_type,
    scope_id: assignment.scope_id,
    scope_label: assignment.scope_label || null,
  };
}

/**
 * Resolves the publishing scope context for News/Documents/Announcements create + edit.
 *
 * Unrestricted (org-wide owning scope + free audience) when:
 * - Platform Owner
 * - CONTENT_EDITOR / OFFICE_MANAGER / OWNER assigned at ORGANISATION/GROUP (or group root)
 *
 * Company/office/dept-only editors stay locked to those assignment scopes so
 * publish/create checks match where NEWS:PUBLISH is actually granted.
 */
export function usePublishingScope() {
  const { isOwner, roleAssignments } = useAuth();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { tree } = useOrgTree();

  return useMemo(() => {
    const assignments = roleAssignments || [];
    const rootNode = tree?.[0] || null;
    const rootId = rootNode?.id != null ? Number(rootNode.id) : null;

    const isOrgWideScope = (a) => {
      if (ORG_WIDE_TYPES.has(a.scope_type)) return true;
      if (rootId != null && Number(a.scope_id) === rootId) return true;
      return false;
    };

    // "Publish anywhere" only when the privileged role is actually org-wide.
    // Company-scoped Content Editor must not claim GROUP owning_scope (server denies).
    const hasOrgWidePublishRole = assignments.some(
      (a) => a.role?.code
        && PUBLISH_ANYWHERE_ROLES.has(a.role.code)
        && isOrgWideScope(a),
    );

    const hasOrgWideAssignment = assignments.some(isOrgWideScope);

    const subOrgAssignments = assignments.filter((a) => !isOrgWideScope(a));

    const lockAudience =
      !isOwner
      && !hasOrgWidePublishRole
      && !hasOrgWideAssignment
      && subOrgAssignments.length > 0;

    const narrowest = lockAudience ? pickNarrowest(subOrgAssignments) : null;

    const owningScope = lockAudience && narrowest
      ? { scope_type: narrowest.scope_type, scope_id: narrowest.scope_id }
      : rootId != null
        ? { scope_type: rootNode?.type || 'GROUP', scope_id: rootId }
        : { scope_type: 'ORGANISATION', scope_id: currentOrganisationId };

    const lockedTargets = lockAudience ? subOrgAssignments.map(toAudienceTarget) : [];

    return { lockAudience, lockedTargets, owningScope };
  }, [isOwner, roleAssignments, currentOrganisationId, tree]);
}
