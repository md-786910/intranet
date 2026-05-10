import React, { useEffect, useMemo, useState } from 'react';
import MaterialIcon from '../../components/common/MaterialIcon';
import { orgService } from '../../services/orgService';

const RANK_COLORS = [
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-zinc-100 text-zinc-700 border-zinc-200',
];

function badgeColor(rank) {
  if (!rank) return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  return RANK_COLORS[(rank - 1) % RANK_COLORS.length];
}

function initials(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
}

function buildHierarchy(nodes) {
  const byId = new Map();
  nodes.forEach((n) => byId.set(n.user_id, { ...n, children: [] }));
  const roots = [];
  byId.forEach((node) => {
    const parentId = node.reports_to_user_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortFn = (a, b) => {
    const ra = a.role_category?.rank ?? 9999;
    const rb = b.role_category?.rank ?? 9999;
    if (ra !== rb) return ra - rb;
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  };
  const sortRecursive = (list) => {
    list.sort(sortFn);
    list.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

function matchesQuery(node, q) {
  if (!q) return true;
  const hay = `${node.first_name} ${node.last_name} ${node.email} ${node.job_title || ''} ${node.role_category?.name || ''}`.toLowerCase();
  return hay.includes(q);
}

function collectMatchingIds(roots, q) {
  if (!q) return null;
  const matched = new Set();
  const walk = (node) => {
    let descendantMatch = false;
    node.children.forEach((c) => { if (walk(c)) descendantMatch = true; });
    if (matchesQuery(node, q) || descendantMatch) {
      matched.add(node.user_id);
      return true;
    }
    return false;
  };
  roots.forEach(walk);
  return matched;
}

function PersonCard({ node, highlight }) {
  const badge = badgeColor(node.role_category?.rank);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white shadow-sm transition-all ${highlight ? 'ring-2 ring-primary/40 border-primary/40' : 'border-zinc-100 hover:border-zinc-200 hover:shadow'}`}>
      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold text-zinc-700 shrink-0 overflow-hidden">
        {node.avatar_url
          ? <img alt="" src={node.avatar_url} className="w-full h-full object-cover" />
          : initials(node.first_name, node.last_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-zinc-900 truncate">{node.first_name} {node.last_name}</span>
          {node.role_category?.name && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge}`}>
              {node.role_category.name}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {node.job_title || node.email}
          {node.primary_department?.name && (
            <span className="text-zinc-400"> · {node.primary_department.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNode({ node, depth, expandedIds, toggle, matchedIds, query }) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.user_id);
  const visibleChildren = matchedIds
    ? node.children.filter((c) => matchedIds.has(c.user_id))
    : node.children;
  const highlight = !!query && matchesQuery(node, query);

  return (
    <li className="relative">
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.user_id)}
            className="mt-3 w-6 h-6 rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 flex items-center justify-center shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <MaterialIcon name={expanded ? 'expand_more' : 'chevron_right'} className="text-base" />
          </button>
        ) : (
          <span className="mt-3 w-6 h-6 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <PersonCard node={node} highlight={highlight} />
          {hasChildren && expanded && visibleChildren.length > 0 && (
            <ul className="mt-3 ml-4 pl-4 border-l border-dashed border-zinc-200 space-y-3">
              {visibleChildren.map((child) => (
                <TreeNode
                  key={child.user_id}
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggle={toggle}
                  matchedIds={matchedIds}
                  query={query}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export default function OrgChartPage() {
  const [data, setData] = useState({ organisation: null, nodes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    orgService.getPeopleTree()
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data || { organisation: null, nodes: [] };
        setData(payload);
        // Auto-expand first 2 levels for a polished default
        const initial = new Set();
        const roots = buildHierarchy(payload.nodes);
        roots.forEach((r) => {
          initial.add(r.user_id);
          r.children.forEach((c) => initial.add(c.user_id));
        });
        setExpandedIds(initial);
      })
      .catch(() => { if (!cancelled) setError('Failed to load org chart'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const roots = useMemo(() => buildHierarchy(data.nodes), [data.nodes]);
  const trimmedQuery = query.trim().toLowerCase();
  const matchedIds = useMemo(
    () => collectMatchingIds(roots, trimmedQuery),
    [roots, trimmedQuery],
  );

  // When searching, auto-expand all ancestors of matched nodes
  useEffect(() => {
    if (!matchedIds) return;
    const expandAll = new Set(expandedIds);
    matchedIds.forEach((id) => expandAll.add(id));
    setExpandedIds(expandAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleRoots = matchedIds
    ? roots.filter((r) => matchedIds.has(r.user_id))
    : roots;

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-display-sm font-bold text-on-background">Organisation Chart</h1>
          {data.organisation?.name && (
            <p className="text-body-md text-zinc-500 mt-1">{data.organisation.name}</p>
          )}
        </div>
        <div className="relative w-full sm:w-80">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, roles, titles…"
            className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-100 shadow-sm">
        {loading && (
          <div className="text-center py-16 text-zinc-500">Loading org chart…</div>
        )}
        {!loading && error && (
          <div className="text-center py-16 text-rose-600">{error}</div>
        )}
        {!loading && !error && roots.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            No employees yet. Once admins invite employees and set their reporting structure, the org chart appears here.
          </div>
        )}
        {!loading && !error && roots.length > 0 && (
          <>
            {data.organisation?.name && (
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary-container/20 border border-primary-container">
                <MaterialIcon name="apartment" className="text-primary" />
                <span className="font-semibold text-on-background">{data.organisation.name}</span>
              </div>
            )}
            {matchedIds && visibleRoots.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No matches.</div>
            ) : (
              <ul className="space-y-3">
                {visibleRoots.map((root) => (
                  <TreeNode
                    key={root.user_id}
                    node={root}
                    depth={0}
                    expandedIds={expandedIds}
                    toggle={toggle}
                    matchedIds={matchedIds}
                    query={trimmedQuery}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
