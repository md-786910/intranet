import React, { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';
import MaterialIcon from '../../components/common/MaterialIcon';
import { orgService } from '../../services/orgService';

const RANK_PILLS = [
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-zinc-100 text-zinc-700 border-zinc-200',
];

function pillColor(rank) {
  if (!rank) return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  return RANK_PILLS[(rank - 1) % RANK_PILLS.length];
}

function fullName(node) {
  return `${node.first_name || ''} ${node.last_name || ''}`.trim();
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
    return fullName(a).localeCompare(fullName(b));
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
  const hay = `${fullName(node)} ${node.email || ''} ${node.job_title || ''} ${node.role_category?.name || ''} ${node.primary_department?.name || ''}`.toLowerCase();
  return hay.includes(q);
}

// For each node that itself matches OR has a matching descendant, add its id.
// The result tells the renderer which subset of the tree to render.
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

// Returns a Map<userId, parentId|null> for ancestor look-ups.
function buildParentIndex(roots) {
  const parentOf = new Map();
  const walk = (node, parentId) => {
    parentOf.set(node.user_id, parentId);
    node.children.forEach((c) => walk(c, node.user_id));
  };
  roots.forEach((r) => walk(r, null));
  return parentOf;
}

// Card sizing tiers — compact across all depths, only avatar size & accent vary
function cardTier(depth) {
  if (depth === 0) return {
    container: 'w-52 p-3',
    avatarSize: 'xl',
    avatarRing: 'border-2 border-primary-container',
    chat: 'bg-primary-container text-on-background hover:opacity-80',
  };
  if (depth === 1) return {
    container: 'w-48 p-3',
    avatarSize: 'lg',
    avatarRing: 'border-2 border-primary-container',
    chat: 'border border-outline-variant text-on-background hover:bg-surface-container-low',
  };
  return {
    container: 'w-44 p-2.5',
    avatarSize: 'md',
    avatarRing: 'border border-primary-container',
    chat: 'border border-outline-variant text-on-background hover:bg-surface-container-low',
  };
}

const PersonCard = memo(function PersonCard({
  node, depth, expanded, hasChildren, onToggle, onChat, highlight,
}) {
  const tier = cardTier(depth);
  return (
    <div
      className={`bg-white border rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col items-center text-center transition-transform hover:-translate-y-0.5 ${tier.container} ${
        highlight ? 'ring-2 ring-primary/40 border-primary/30' : 'border-outline-variant'
      }`}
    >
      <div className={`rounded-full overflow-hidden mb-2 ${tier.avatarRing}`}>
        <Avatar src={node.avatar_url} name={fullName(node)} size={tier.avatarSize} className="border-0" />
      </div>

      <h3 className="text-sm font-semibold text-on-background leading-tight truncate max-w-full">
        {fullName(node)}
      </h3>

      {node.job_title && (
        <p className="text-[11px] text-secondary mt-0.5 line-clamp-2 leading-snug">{node.job_title}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
        {node.role_category?.name && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${pillColor(node.role_category?.rank)}`}>
            {node.role_category.name}
          </span>
        )}
        {node.primary_department?.name && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant text-[10px] truncate max-w-[8rem]">
            {node.primary_department.name}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChat(node.user_id)}
        className={`mt-2.5 w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${tier.chat}`}
      >
        <MaterialIcon name="chat" className="text-[14px]" />
        <span>Chat</span>
      </button>

      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1.5 -mb-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-on-surface-variant hover:text-on-background transition-colors"
          aria-expanded={expanded}
        >
          <MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} className="text-sm" />
          <span>
            {expanded ? 'Collapse' : `${node.children.length} ${node.children.length === 1 ? 'report' : 'reports'}`}
          </span>
        </button>
      )}
    </div>
  );
});

// Recursive top-down tree node. Children render in a flex row beneath the
// card, connected by 2px lines. Collapsed subtrees mount no children DOM.
const TreeNode = memo(function TreeNode({
  node, depth, expandedIds, toggle, onChat, matchedIds, query,
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.user_id);
  const visibleChildren = hasChildren && expanded
    ? (matchedIds ? node.children.filter((c) => matchedIds.has(c.user_id)) : node.children)
    : [];
  const showSubtree = visibleChildren.length > 0;
  const highlight = !!query && matchesQuery(node, query);

  return (
    <div className="flex flex-col items-center">
      <PersonCard
        node={node}
        depth={depth}
        expanded={expanded}
        hasChildren={hasChildren}
        onToggle={() => toggle(node.user_id)}
        onChat={onChat}
        highlight={highlight}
      />

      {showSubtree && (
        <>
          {/* vertical drop from card */}
          <div className="w-0.5 h-6 bg-outline-variant" />

          {/* row of children with horizontal trunk above them */}
          <div className="relative flex items-start justify-around gap-unit-md pt-6 px-3">
            {visibleChildren.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-outline-variant"
                style={{
                  left: `calc(50% / ${visibleChildren.length})`,
                  right: `calc(50% / ${visibleChildren.length})`,
                }}
              />
            )}
            {visibleChildren.map((child) => (
              <div key={child.user_id} className="flex flex-col items-center relative">
                {/* vertical line UP from each child to the trunk */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-outline-variant" />
                <TreeNode
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggle={toggle}
                  onChat={onChat}
                  matchedIds={matchedIds}
                  query={query}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

export default function OrgChartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ organisation: null, nodes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState(() => searchParams.get('dept') || '');
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const load = () => {
    setLoading(true);
    setError(null);
    return orgService.getPeopleTree()
      .then((res) => {
        const payload = res.data?.data || { organisation: null, nodes: [] };
        setData(payload);
        // Default expansion: roots + their immediate children. Anything deeper
        // starts collapsed so a 200-person org paints fast.
        const initial = new Set();
        const roots = buildHierarchy(payload.nodes);
        roots.forEach((r) => {
          initial.add(r.user_id);
          r.children.forEach((c) => initial.add(c.user_id));
        });
        setExpandedIds(initial);
      })
      .catch(() => setError('Failed to load org chart'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const roots = useMemo(() => buildHierarchy(data.nodes), [data.nodes]);
  const parentOf = useMemo(() => buildParentIndex(roots), [roots]);

  const trimmedQuery = query.trim().toLowerCase();
  const matchedIds = useMemo(
    () => collectMatchingIds(roots, trimmedQuery),
    [roots, trimmedQuery],
  );

  // When the search becomes active, expand every ancestor of every match.
  useEffect(() => {
    if (!matchedIds || matchedIds.size === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      matchedIds.forEach((id) => {
        let cursor = id;
        while (cursor) {
          next.add(cursor);
          cursor = parentOf.get(cursor) || null;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleChat = (userId) => {
    navigate(`/people?userId=${userId}`);
  };

  const visibleRoots = matchedIds
    ? roots.filter((r) => matchedIds.has(r.user_id))
    : roots;

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
      <header className="mb-unit-xl text-center">
        <h1 className="font-h1 text-h1 text-on-background mb-unit-sm">Organisation Chart</h1>
        {data.organisation?.name ? (
          <p className="font-body-lg text-secondary">{data.organisation.name}</p>
        ) : (
          <p className="font-body-lg text-secondary">Browse the team hierarchy and start a chat with anyone.</p>
        )}
      </header>

      <div className="flex justify-center mb-unit-lg">
        <div className="relative w-full max-w-md">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, roles, titles…"
            className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
          />
        </div>
      </div>

      <div className="bg-surface-container-low/40 rounded-3xl border border-outline-variant/40 p-4 sm:p-6">
        {loading && (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-error mb-3">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-background font-semibold hover:opacity-80"
            >
              <MaterialIcon name="refresh" />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && roots.length === 0 && (
          <div className="text-center py-16 text-secondary">
            No employees yet. Once admins invite employees and set their reporting structure, the org chart appears here.
          </div>
        )}

        {!loading && !error && roots.length > 0 && (
          <>
            {matchedIds && visibleRoots.length === 0 ? (
              <div className="text-center py-12 text-secondary">No matches.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-flex justify-center min-w-full px-4 py-6">
                  <div className="flex items-start gap-unit-xl">
                    {visibleRoots.map((root) => (
                      <TreeNode
                        key={root.user_id}
                        node={root}
                        depth={0}
                        expandedIds={expandedIds}
                        toggle={toggle}
                        onChat={handleChat}
                        matchedIds={matchedIds}
                        query={trimmedQuery}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
