import React, { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { useOrgTree } from '../../hooks/useOrgTree';
import { useChatUnread } from '../../contexts/ChatUnreadContext';
import { findScopePath } from '../../utils/scopeLabel';

const SCOPE_RANK = { DEPARTMENT: 4, VERTICAL: 3, OFFICE_LOCATION: 2, ORGANISATION: 1, COMPANY: 2, GROUP: 1 };

function pickPrimaryAssignment(assignments) {
  if (!assignments?.length) return null;
  // Prefer org-wide / Group-root assignments so Content Editors with
  // publish-anywhere aren't labeled by a narrower Employee membership.
  const orgWide = assignments.find(
    (a) => a.scope_type === 'GROUP' || a.scope_type === 'ORGANISATION' || a.role?.code === 'OWNER',
  );
  if (orgWide) return orgWide;
  return [...assignments].sort(
    (a, b) => (SCOPE_RANK[b.scope_type] || 0) - (SCOPE_RANK[a.scope_type] || 0),
  )[0];
}

function HierarchyRow({ segments }) {
  if (!segments?.length) return null;

  return (
    <div className="flex items-center gap-1 min-w-0 max-w-xl overflow-x-auto">
      {segments.map((seg, i) => (
        <React.Fragment key={`${seg.type}-${seg.name}-${i}`}>
          {i > 0 && (
            <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          <div
            className={`flex-shrink-0 inline-flex flex-col px-2.5 py-1 rounded-lg border ${
              i === segments.length - 1
                ? 'bg-primary-50 border-primary-100'
                : 'bg-gray-50 border-gray-100'
            }`}
            title={`${seg.type}: ${seg.name}`}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 leading-none">
              {seg.type}
            </span>
            <span
              className={`text-[12px] font-semibold truncate max-w-[9rem] mt-0.5 ${
                i === segments.length - 1 ? 'text-primary-700' : 'text-gray-700'
              }`}
            >
              {seg.name}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Header() {
  const { user, isOwner, roleAssignments } = useAuth();
  const { currentOrganisationName } = useCurrentOrganisation();
  const { tree } = useOrgTree();
  const { totalUnread: chatUnread } = useChatUnread();

  const hierarchySegments = useMemo(() => {
    const primary = pickPrimaryAssignment(roleAssignments || []);

    if (primary?.scope_id && tree?.length) {
      const path = findScopePath(tree, primary.scope_type, primary.scope_id);
      if (path?.length) return path;
    }

    // Owner / org-wide: show organisation as a single segment
    if (currentOrganisationName) {
      return [{ type: isOwner ? 'Owner' : 'Organisation', name: currentOrganisationName }];
    }

    return [];
  }, [roleAssignments, tree, currentOrganisationName, isOwner]);

  const roleName = useMemo(() => {
    if (isOwner) return 'Platform Owner';
    const primary = pickPrimaryAssignment(roleAssignments || []);
    return primary?.role?.name || null;
  }, [isOwner, roleAssignments]);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-shrink-0">
        <h2 className="text-[15px] font-semibold text-gray-800 tracking-tight truncate">
          Welcome back, {user?.first_name || 'User'}
        </h2>
        {roleName && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{roleName}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 min-w-0 flex-1">
        <HierarchyRow segments={hierarchySegments} />
        {chatUnread > 0 && (
          <div
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1"
            title={`${chatUnread} unread chat message${chatUnread === 1 ? '' : 's'}`}
          >
            <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75c0 4.556 4.694 7.5 9.75 7.5s9.75-2.944 9.75-7.5-4.694-7.5-9.75-7.5-9.75 2.944-9.75 7.5z" />
            </svg>
            <span className="text-xs font-semibold text-primary-700">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
