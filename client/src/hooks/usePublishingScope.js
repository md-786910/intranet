import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useCurrentOrganisation } from './useCurrentOrganisation';

const SCOPE_RANK = {
  DEPARTMENT: 4,
  VERTICAL: 3,
  OFFICE_LOCATION: 2,
  ORGANISATION: 1,
};

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
 * - Platform Owner or users with any ORGANISATION-scope assignment: unrestricted.
 *   Audience selector stays empty and enabled; owning_scope = ORGANISATION.
 * - Sub-org-only users (OFFICE / VERTICAL / DEPARTMENT): audience is locked to
 *   their assignments and disabled; owning_scope follows their narrowest scope
 *   so backend `checkPermission` ancestor walk matches their role assignment.
 */
export function usePublishingScope() {
  const { isOwner, roleAssignments } = useAuth();
  const { currentOrganisationId } = useCurrentOrganisation();

  return useMemo(() => {
    const assignments = roleAssignments || [];
    const orgAssignments = assignments.filter((a) => a.scope_type === 'ORGANISATION');
    const subOrgAssignments = assignments.filter((a) => a.scope_type !== 'ORGANISATION');

    const lockAudience =
      !isOwner && orgAssignments.length === 0 && subOrgAssignments.length > 0;

    const narrowest = lockAudience ? pickNarrowest(subOrgAssignments) : null;

    const owningScope = lockAudience && narrowest
      ? { scope_type: narrowest.scope_type, scope_id: narrowest.scope_id }
      : { scope_type: 'ORGANISATION', scope_id: currentOrganisationId };

    const lockedTargets = lockAudience ? subOrgAssignments.map(toAudienceTarget) : [];

    return { lockAudience, lockedTargets, owningScope };
  }, [isOwner, roleAssignments, currentOrganisationId]);
}
