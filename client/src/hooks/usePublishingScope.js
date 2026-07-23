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
 * Resolves the publishing scope context for News/Documents create + edit flows.
 *
 * Unrestricted audience when:
 * - Platform Owner
 * - CONTENT_EDITOR / OFFICE_MANAGER (can choose any hierarchy)
 * - Any ORGANISATION/GROUP-scope assignment, or role attached to the Group root node
 *
 * Other roles with only sub-org assignments stay locked to those scopes.
 */
export function usePublishingScope() {
  const { isOwner, roleAssignments } = useAuth();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { tree } = useOrgTree();

  return useMemo(() => {
    const assignments = roleAssignments || [];
    const rootNode = tree?.[0] || null;
    const rootId = rootNode?.id != null ? Number(rootNode.id) : null;

    const hasPublishAnywhereRole = assignments.some(
      (a) => a.role?.code && PUBLISH_ANYWHERE_ROLES.has(a.role.code),
    );

    const hasOrgWideAssignment = assignments.some((a) => {
      if (ORG_WIDE_TYPES.has(a.scope_type)) return true;
      if (rootId != null && Number(a.scope_id) === rootId) return true;
      return false;
    });

    const subOrgAssignments = assignments.filter((a) => {
      if (ORG_WIDE_TYPES.has(a.scope_type)) return false;
      if (rootId != null && Number(a.scope_id) === rootId) return false;
      return true;
    });

    const lockAudience =
      !isOwner
      && !hasPublishAnywhereRole
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
