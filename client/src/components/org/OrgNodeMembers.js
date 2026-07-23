import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function managerName(m) {
  if (!m.manager) return null;
  return [m.manager.first_name, m.manager.last_name].filter(Boolean).join(' ') || null;
}

/**
 * Walk the member tree and collect only groups that have people,
 * with a breadcrumb path for hierarchy (avoids stacked unit rows).
 */
function collectGroups(node, path = [], groups = [], isRoot = true) {
  if (!node) return groups;

  const nextPath = isRoot ? path : [...path, node.name];
  const members = node.members || [];

  if (members.length > 0) {
    groups.push({
      key: `g-${node.id}`,
      path: nextPath,
      members: members.map((m) => ({
        user_id: m.user_id,
        membership_id: m.membership_id,
        first_name: m.first_name || '',
        last_name: m.last_name || '',
        email: m.email || null,
        job_title: m.job_title || null,
        is_primary: !!m.is_primary,
        role_code: m.role_code || null,
        role_label: m.role_label || 'Other',
        roles: m.roles || [],
        reports_to: managerName(m),
      })),
    });
  }

  (node.children || []).forEach((child) => {
    collectGroups(child, nextPath, groups, false);
  });

  return groups;
}

const OPEN_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

const ROLE_BADGE_STYLES = {
  OWNER: 'bg-amber-50 text-amber-800',
  OFFICE_MANAGER: 'bg-violet-50 text-violet-700',
  CONTENT_EDITOR: 'bg-sky-50 text-sky-700',
  EMPLOYEE: 'bg-emerald-50 text-emerald-700',
};

function RoleBadge({ code, label }) {
  const style = ROLE_BADGE_STYLES[code] || 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide ${style}`}
      title={label}
    >
      {label || 'Other'}
    </span>
  );
}

function MemberItem({ member }) {
  const extraRoles = (member.roles || []).filter((r) => r.code && r.code !== member.role_code);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 min-w-0 flex-1">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">First name</p>
            <p className="text-sm font-medium text-gray-900 truncate" title={member.first_name || ''}>
              {member.first_name || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Last name</p>
            <p className="text-sm font-medium text-gray-900 truncate" title={member.last_name || ''}>
              {member.last_name || '—'}
            </p>
          </div>
          <div className="min-w-0 col-span-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">Role</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <RoleBadge code={member.role_code} label={member.role_label} />
              {extraRoles.slice(0, 2).map((r) => (
                <RoleBadge key={r.code} code={r.code} label={r.name} />
              ))}
              {extraRoles.length > 2 && (
                <span className="text-[9px] font-medium text-gray-400">+{extraRoles.length - 2}</span>
              )}
              {member.is_primary && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Title</p>
            <p className="text-xs text-gray-700 truncate" title={member.job_title || ''}>
              {member.job_title || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Reports to</p>
            <p className="text-xs text-gray-700 truncate" title={member.reports_to || ''}>
              {member.reports_to || '—'}
            </p>
          </div>
          <div className="min-w-0 col-span-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Email</p>
            <p className="text-xs text-gray-600 truncate" title={member.email || ''}>
              {member.email || '—'}
            </p>
          </div>
        </div>
        {member.user_id && (
          <Link
            to={`/users/${member.user_id}?from=${encodeURIComponent('/organisation')}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open user details"
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
          >
            {OPEN_ICON}
          </Link>
        )}
      </div>
    </div>
  );
}

function GroupBlock({ group, showPath, open, onToggle }) {
  const count = group.members.length;
  const pathLabel = group.path.length > 0
    ? group.path.join(' › ')
    : 'This unit';
  const title = showPath && group.path.length > 0 ? pathLabel : 'This unit';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <svg
          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800 truncate" title={title}>
          {group.path.length > 0 ? (
            group.path.map((seg, i) => (
              <span key={`${group.key}-${i}`}>
                {i > 0 && <span className="mx-1 font-normal text-gray-400">›</span>}
                <span className={i === group.path.length - 1 ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}>
                  {seg}
                </span>
              </span>
            ))
          ) : (
            <span className="font-semibold text-gray-900">{title}</span>
          )}
        </span>
        <span className="flex-shrink-0 text-xs font-medium tabular-nums text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          {count}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 bg-gray-50/60 border-t border-gray-100">
          {group.members.map((m) => (
            <MemberItem key={m.membership_id || m.user_id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgNodeMembers({ data, loading, error }) {
  const groups = useMemo(() => {
    if (!data) return [];
    return collectGroups({
      id: data.node?.id,
      name: data.node?.name,
      members: data.members || [],
      children: data.children || [],
    });
  }, [data]);

  // Default: only the first group expanded
  const [openKeys, setOpenKeys] = useState(() => new Set());

  useEffect(() => {
    if (groups.length === 0) {
      setOpenKeys(new Set());
      return;
    }
    setOpenKeys(new Set([groups[0].key]));
  }, [groups]);

  const toggleGroup = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-20 animate-pulse" />
        <div className="rounded-lg border border-gray-100 p-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5 animate-pulse">
              <div className="h-3.5 bg-gray-100 rounded w-1/2" />
              <div className="h-2.5 bg-gray-50 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  const total = data?.total ?? 0;
  const showPaths = groups.some((g) => g.path.length > 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Members</h3>
        <span className="text-xs text-gray-400 tabular-nums">{total}</span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-gray-400 py-1">No members here yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="max-h-72 overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
            {groups.map((group) => (
              <GroupBlock
                key={group.key}
                group={group}
                showPath={showPaths}
                open={openKeys.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
