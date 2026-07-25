import React from 'react';

const TOP_COLORS = [
  '#6366f1', '#8b5cf6', '#0ea5e9',
  '#14b8a6', '#10b981', '#f59e0b',
];

const AVATAR_BG = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600',
  'bg-teal-600', 'bg-emerald-600', 'bg-amber-600',
];

function getInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compact person card for the LTR org tree.
 */
export function OrgPersonCard({
  user,
  depth = 0,
  size = 'md',
  selected = false,
  expanded = false,
  loading = false,
  noReports = false,
  reportCount = null,
  onToggleExpand,
  onOpenProfile,
}) {
  const color = TOP_COLORS[depth % TOP_COLORS.length];
  const avatarBg = AVATAR_BG[depth % AVATAR_BG.length];
  const isLg = size === 'lg';
  const title = user.jobTitle || user.department || user.userPrincipalName || '';
  const knownCount = typeof reportCount === 'number' ? reportCount : null;
  const hasReports = knownCount === null ? !noReports : knownCount > 0;
  const canExpand = Boolean(onToggleExpand) && hasReports && !noReports;

  let expandLabel = 'Expand';
  if (loading) expandLabel = 'Loading…';
  else if (expanded) {
    expandLabel = knownCount > 0 ? `Collapse (${knownCount})` : 'Collapse';
  } else if (knownCount > 0) {
    expandLabel = `Expand (${knownCount})`;
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border shrink-0 transition-shadow ${
        isLg ? 'w-60' : 'w-52'
      } ${selected ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-100'}`}
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className={`flex items-center gap-3 px-3 ${isLg ? 'py-3' : 'py-2.5'}`}>
        <div
          className={`${isLg ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'} rounded-full ${avatarBg} flex items-center justify-center text-white font-bold shrink-0`}
        >
          {getInitials(user.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`${isLg ? 'text-sm' : 'text-sm'} font-semibold text-gray-900 truncate leading-tight`}>
            {user.displayName}
          </p>
          {title && (
            <p className="text-[11px] text-gray-500 truncate leading-tight mt-0.5">{title}</p>
          )}
        </div>
        {knownCount > 0 && !expanded && (
          <span
            className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-semibold tabular-nums flex items-center justify-center"
            title={`${knownCount} direct report${knownCount === 1 ? '' : 's'}`}
          >
            {knownCount}
          </span>
        )}
        {user.accountEnabled === false && (
          <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" title="Disabled" />
        )}
      </div>

      <div className="px-3 pb-2.5 flex gap-1.5">
        {canExpand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(user);
            }}
            disabled={loading}
            className="flex-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 border border-primary-100 rounded-lg py-1.5 transition-colors disabled:opacity-50"
          >
            {expandLabel}
          </button>
        )}
        {(noReports || knownCount === 0) && (
          <span className="flex-1 text-[11px] text-center text-gray-400 py-1.5">No reports</span>
        )}
        {onOpenProfile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile(user);
            }}
            className={`${canExpand || noReports || knownCount === 0 ? 'flex-1' : 'w-full'} text-[11px] font-medium text-gray-600 hover:text-primary-700 hover:bg-gray-50 border border-gray-100 rounded-lg py-1.5 transition-colors`}
          >
            Profile
          </button>
        )}
      </div>
    </div>
  );
}

/** Elbow / spine connectors for one child row in a vertical sibling stack. */
function SiblingConnectors({ isFirst, isLast, single }) {
  return (
    <div className="w-8 shrink-0 relative self-stretch min-h-[3rem]">
      {single ? (
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-300 -translate-y-1/2" />
      ) : (
        <>
          {isFirst && (
            <div className="absolute left-0 top-1/2 h-0.5 bg-gray-300 -translate-y-1/2 w-1/2" />
          )}
          <div
            className="absolute left-1/2 w-0.5 bg-gray-300 -translate-x-1/2"
            style={{
              top: isFirst ? '50%' : 0,
              bottom: isLast ? '50%' : 0,
            }}
          />
          <div className="absolute left-1/2 right-0 top-1/2 h-0.5 bg-gray-300 -translate-y-1/2" />
        </>
      )}
    </div>
  );
}

/**
 * Recursive left-to-right org node.
 * Children render to the RIGHT of the card when expanded.
 */
export function OrgTreeNode({
  user,
  depth = 0,
  isRoot = false,
  pathIds,
  expandedIds,
  childrenById,
  countById,
  loadingIds,
  noReportsIds,
  selectedId,
  onToggleExpand,
  onOpenProfile,
}) {
  const expanded = expandedIds.has(user.id);
  const children = childrenById[user.id];
  const loading = loadingIds.has(user.id);
  const noReports = noReportsIds.has(user.id);
  const reportCount = countById?.[user.id];
  const nextPath = pathIds.has(user.id) ? pathIds : new Set([...pathIds, user.id]);
  const hasCycle = pathIds.has(user.id);

  if (hasCycle) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
        <span>↺</span>
        <span className="truncate max-w-[180px]">{user.displayName}</span>
      </div>
    );
  }

  const card = (
    <OrgPersonCard
      user={user}
      depth={depth}
      size={isRoot ? 'lg' : 'md'}
      selected={selectedId === user.id}
      expanded={expanded}
      loading={loading}
      noReports={noReports}
      reportCount={typeof reportCount === 'number' ? reportCount : null}
      onToggleExpand={noReports || reportCount === 0 ? undefined : onToggleExpand}
      onOpenProfile={onOpenProfile}
    />
  );

  const childrenColumn = expanded && Array.isArray(children) && children.length > 0 && (
    <div className="flex flex-row items-center">
      <ul className="flex flex-col gap-3 list-none m-0 p-0">
        {children.map((child, idx) => (
          <li key={child.id} className="flex flex-row items-center">
            <SiblingConnectors
              isFirst={idx === 0}
              isLast={idx === children.length - 1}
              single={children.length === 1}
            />
            <OrgTreeNode
              user={child}
              depth={depth + 1}
              pathIds={nextPath}
              expandedIds={expandedIds}
              childrenById={childrenById}
              countById={countById}
              loadingIds={loadingIds}
              noReportsIds={noReportsIds}
              selectedId={selectedId}
              onToggleExpand={onToggleExpand}
              onOpenProfile={onOpenProfile}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  if (isRoot) {
    return (
      <div className="flex flex-row items-center">
        {card}
        {expanded && Array.isArray(children) && children.length > 0 && (
          <>
            {/* Stem from root into first-level spine */}
            <div className="w-4 h-0.5 bg-gray-300 shrink-0" aria-hidden />
            {childrenColumn}
          </>
        )}
      </div>
    );
  }

  // Nested node: card + optional children to the right (already wrapped by parent's connectors)
  return (
    <div className="flex flex-row items-center">
      {card}
      {childrenColumn}
    </div>
  );
}

/** @deprecated kept for import safety — use OrgTreeNode */
export function OrgReportsBranch() {
  return null;
}

export default function AzureOrgChart() {
  return null;
}
