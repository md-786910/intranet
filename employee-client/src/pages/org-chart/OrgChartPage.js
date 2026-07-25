import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';
import MaterialIcon from '../../components/common/MaterialIcon';
import { orgService } from '../../services/orgService';
import { azureAdService } from '../../services/azureAdService';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

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
  return `${node.first_name || ''} ${node.last_name || ''}`.trim() || node.displayName || '?';
}

function splitDisplayName(displayName = '') {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '?', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

/** Merge Entra tree person with local DB profile (local wins for display fields). */
function enrichEntraUser(entraUser, localByAzureId) {
  const local = localByAzureId.get(entraUser.id);
  const names = splitDisplayName(entraUser.displayName);

  // Entra public payload is name + job title only; never take mail/UPN/department from Graph here.
  if (local) {
    return {
      azure_id: entraUser.id,
      user_id: local.user_id,
      first_name: local.first_name || names.first_name,
      last_name: local.last_name || names.last_name,
      email: local.email || '',
      avatar_url: local.avatar_url || null,
      job_title: local.job_title || entraUser.jobTitle || null,
      role_category: local.role_category || null,
      primary_department: local.primary_department || null,
      canChat: Boolean(local.can_chat),
      children: [],
      childrenLoaded: false,
      noReports: false,
    };
  }

  return {
    azure_id: entraUser.id,
    user_id: entraUser.local_user_id || null,
    first_name: names.first_name,
    last_name: names.last_name,
    email: '',
    avatar_url: null,
    job_title: entraUser.jobTitle || null,
    role_category: null,
    primary_department: null,
    canChat: false,
    children: [],
    childrenLoaded: false,
    noReports: false,
  };
}

function matchesQuery(node, q) {
  if (!q) return true;
  const hay = `${fullName(node)} ${node.job_title || ''} ${node.role_category?.name || ''} ${node.primary_department?.name || ''}`.toLowerCase();
  return hay.includes(q);
}

function collectMatchingIds(roots, q) {
  if (!q) return null;
  const matched = new Set();
  const walk = (node) => {
    let descendantMatch = false;
    (node.children || []).forEach((c) => { if (walk(c)) descendantMatch = true; });
    if (matchesQuery(node, q) || descendantMatch) {
      matched.add(node.azure_id);
      return true;
    }
    return false;
  };
  roots.forEach(walk);
  return matched;
}

function buildParentIndex(roots) {
  const parentOf = new Map();
  const walk = (node, parentId) => {
    parentOf.set(node.azure_id, parentId);
    (node.children || []).forEach((c) => walk(c, node.azure_id));
  };
  roots.forEach((r) => walk(r, null));
  return parentOf;
}

function localDeptMatch(person, dept, deptId) {
  if (deptId) {
    return Number(person.primary_department?.id) === Number(deptId);
  }
  if (!dept) return false;
  const name = (person.primary_department?.name || '').toLowerCase();
  return name.includes(dept);
}

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
  node, depth, expanded, canExpand, loadingChildren, onToggle, onChat, highlight,
}) {
  const tier = cardTier(depth);
  const canChat = Boolean(node.user_id && node.canChat);

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

      {canChat && (
        <button
          type="button"
          onClick={() => onChat(node.user_id)}
          className={`mt-2.5 w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${tier.chat}`}
        >
          <MaterialIcon name="chat" className="text-[14px]" />
          <span>Chat</span>
        </button>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={onToggle}
          disabled={loadingChildren}
          className="mt-1.5 -mb-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-on-surface-variant hover:text-on-background transition-colors disabled:opacity-60"
          aria-expanded={expanded}
        >
          {loadingChildren ? (
            <span className="inline-flex items-center gap-1">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
              </svg>
              Loading…
            </span>
          ) : (
            <>
              <MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} className="text-sm" />
              <span>
                {expanded
                  ? 'Collapse'
                  : (node.childrenLoaded
                    ? `${node.children.length} ${node.children.length === 1 ? 'report' : 'reports'}`
                    : 'Expand')}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
});

const TreeNode = memo(function TreeNode({
  node, depth, expandedIds, toggle, loadChildren, loadingIds, onChat, matchedIds, query,
}) {
  const expanded = expandedIds.has(node.azure_id);
  const loadingChildren = loadingIds.has(node.azure_id);
  const canExpand = !node.noReports;
  const visibleChildren = expanded && node.childrenLoaded
    ? (matchedIds ? node.children.filter((c) => matchedIds.has(c.azure_id)) : node.children)
    : [];
  const showSubtree = visibleChildren.length > 0;
  const highlight = !!query && matchesQuery(node, query);

  return (
    <div className="flex flex-col items-center">
      <PersonCard
        node={node}
        depth={depth}
        expanded={expanded}
        canExpand={canExpand}
        loadingChildren={loadingChildren}
        onToggle={() => toggle(node)}
        onChat={onChat}
        highlight={highlight}
      />

      {showSubtree && (
        <>
          <div className="w-0.5 h-6 bg-outline-variant" />
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
              <div key={child.azure_id} className="flex flex-col items-center relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-outline-variant" />
                <TreeNode
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggle={toggle}
                  loadChildren={loadChildren}
                  loadingIds={loadingIds}
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

function updateNodeInForest(roots, azureId, updater) {
  const walk = (list) => list.map((n) => {
    if (n.azure_id === azureId) return updater(n);
    if (!n.children?.length) return n;
    return { ...n, children: walk(n.children) };
  });
  return walk(roots);
}

/** Flat department member card (local DB) — used when View opens ?deptId= */
function DeptMemberCard({ person }) {
  const name = fullName(person);
  return (
    <div className="bg-white border border-outline-variant rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center text-center w-52">
      <div className="rounded-full overflow-hidden mb-2 border-2 border-primary-container">
        <Avatar src={person.avatar_url} name={name} size="lg" className="border-0" />
      </div>
      <h3 className="text-sm font-semibold text-on-background leading-tight truncate max-w-full">{name}</h3>
      {person.job_title && (
        <p className="text-[11px] text-secondary mt-0.5 line-clamp-2">{person.job_title}</p>
      )}
      {(person.role_label || person.primary_department?.name) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
          {person.role_label && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-amber-100 text-amber-800 border-amber-200">
              {person.role_label}
            </span>
          )}
          {person.primary_department?.name && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant text-[10px]">
              {person.primary_department.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [organisation, setOrganisation] = useState(null);
  const [localPeople, setLocalPeople] = useState([]);
  const [localByAzureId, setLocalByAzureId] = useState(() => new Map());
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [deptFilter, setDeptFilter] = useState(() => (searchParams.get('dept') || '').trim().toLowerCase());
  const [deptId, setDeptId] = useState(() => {
    const raw = searchParams.get('deptId');
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const [deptMembers, setDeptMembers] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [loadingIds, setLoadingIds] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const inflightRef = useRef(new Set());
  const chartScrollRef = useRef(null);
  const panRef = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0 });

  const isDeptView = Boolean(deptId || deptFilter);

  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10)),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10)),
    [],
  );
  const zoomReset = useCallback(() => setZoom(1), []);

  // Ctrl/Cmd + wheel zoom (native non-passive so preventDefault works)
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el || isDeptView) return undefined;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10));
      } else if (e.deltaY > 0) {
        setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isDeptView, loading, error, roots.length]);

  // Left-click drag to pan (skip when interacting with buttons/links)
  const onChartMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    const el = chartScrollRef.current;
    if (!el) return;
    panRef.current = {
      active: true,
      moved: false,
      x: e.pageX,
      y: e.pageY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
    setIsPanning(true);
  };

  const onChartMouseMove = (e) => {
    if (!panRef.current.active) return;
    e.preventDefault();
    const el = chartScrollRef.current;
    if (!el) return;
    const dx = e.pageX - panRef.current.x;
    const dy = e.pageY - panRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panRef.current.moved = true;
    el.scrollLeft = panRef.current.sl - dx;
    el.scrollTop = panRef.current.st - dy;
  };

  const endPan = () => {
    if (!panRef.current.active) return;
    panRef.current.active = false;
    setIsPanning(false);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      azureAdService.getOrgTreeRoots(),
      orgService.getPeopleTree(),
    ])
      .then(([entraRes, localRes]) => {
        const localPayload = localRes.data?.data || { organisation: null, nodes: [] };
        setOrganisation(localPayload.organisation || null);
        const people = localPayload.nodes || [];
        setLocalPeople(people);

        const byAzure = new Map();
        people.forEach((n) => {
          if (n.azure_object_id) byAzure.set(n.azure_object_id, n);
        });
        setLocalByAzureId(byAzure);

        const entraRoots = entraRes.data?.data || [];
        const enrichedRoots = entraRoots.map((u) => enrichEntraUser(u, byAzure));
        setRoots(enrichedRoots);
        setExpandedIds(new Set(enrichedRoots.map((r) => r.azure_id)));
      })
      .catch(() => setError('Failed to load org chart'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Department View: load members of the specific org node the user clicked (their unit only).
  useEffect(() => {
    if (!deptId) {
      setDeptMembers([]);
      return undefined;
    }
    let cancelled = false;
    setDeptLoading(true);
    orgService.listNodeMembers(deptId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || {};
        // Only members attached directly to this node (matches home memberCount).
        const members = data.members || [];
        setDeptMembers(members);
        if (data.node?.name) {
          setDeptFilter(String(data.node.name).toLowerCase());
        }
      })
      .catch(() => {
        if (!cancelled) setDeptMembers([]);
      })
      .finally(() => {
        if (!cancelled) setDeptLoading(false);
      });
    return () => { cancelled = true; };
  }, [deptId]);

  const visibleDeptMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deptMembers;
    return deptMembers.filter((p) => {
      const hay = `${fullName(p)} ${p.email || ''} ${p.job_title || ''} ${p.role_label || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deptMembers, query]);

  // Fallback when only ?dept=name (no deptId): filter people-tree by name within local list.
  const fallbackDeptMembers = useMemo(() => {
    if (deptId || !deptFilter) return [];
    const q = query.trim().toLowerCase();
    return localPeople.filter((p) => {
      if (!localDeptMatch(p, deptFilter, null)) return false;
      if (!q) return true;
      const hay = `${fullName(p)} ${p.email || ''} ${p.job_title || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deptId, deptFilter, localPeople, query]);

  const shownDeptMembers = deptId ? visibleDeptMembers : fallbackDeptMembers;

  const loadChildren = useCallback(async (node) => {
    if (!node?.azure_id || node.childrenLoaded || node.noReports) return node?.children || [];
    if (inflightRef.current.has(node.azure_id)) return node?.children || [];
    inflightRef.current.add(node.azure_id);
    setLoadingIds((prev) => new Set(prev).add(node.azure_id));
    try {
      const res = await azureAdService.getDirectReports(node.azure_id);
      const reports = (res.data?.data || []).map((u) => enrichEntraUser(u, localByAzureId));
      setRoots((prev) => updateNodeInForest(prev, node.azure_id, (n) => ({
        ...n,
        children: reports,
        childrenLoaded: true,
        noReports: reports.length === 0,
      })));
      return reports;
    } catch {
      setRoots((prev) => updateNodeInForest(prev, node.azure_id, (n) => ({
        ...n,
        children: [],
        childrenLoaded: true,
        noReports: true,
      })));
      return [];
    } finally {
      inflightRef.current.delete(node.azure_id);
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(node.azure_id);
        return next;
      });
    }
  }, [localByAzureId]);

  useEffect(() => {
    if (loading || roots.length === 0 || isDeptView) return undefined;
    roots.forEach((root) => {
      if (!root.childrenLoaded && !root.noReports && expandedIds.has(root.azure_id)) {
        loadChildren(root);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roots, expandedIds, loadChildren, isDeptView]);

  const parentOf = useMemo(() => buildParentIndex(roots), [roots]);
  const trimmedQuery = query.trim().toLowerCase();
  const matchedIds = useMemo(
    () => (isDeptView ? null : collectMatchingIds(roots, trimmedQuery)),
    [roots, trimmedQuery, isDeptView],
  );

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

  const toggle = useCallback(async (node) => {
    const id = node.azure_id;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!expandedIds.has(id) && !node.childrenLoaded) {
      await loadChildren(node);
    }
  }, [expandedIds, loadChildren]);

  const handleChat = (userId) => {
    navigate(`/people?userId=${userId}`);
  };

  const clearDept = () => {
    setDeptFilter('');
    setDeptId(null);
    navigate('/org-chart', { replace: true });
  };

  const visibleRoots = matchedIds
    ? roots.filter((r) => matchedIds.has(r.azure_id))
    : roots;

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
      <header className="mb-unit-xl text-center">
        <h1 className="font-h1 text-h1 text-on-background mb-unit-sm">Organisation Chart</h1>
        {organisation?.name ? (
          <p className="font-body-lg text-secondary">{organisation.name}</p>
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

      {isDeptView && (
        <div className="flex justify-center mb-unit-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container/30 text-sm text-on-background">
            <span>Department: <strong className="capitalize">{deptFilter || 'selected'}</strong></span>
            <button type="button" onClick={clearDept} className="text-xs font-semibold text-primary hover:underline">
              Clear
            </button>
          </div>
        </div>
      )}

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

        {/* Department view — only the specific unit from the user's org (deptId) */}
        {!loading && !error && isDeptView && (
          deptLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : shownDeptMembers.length === 0 ? (
            <div className="text-center py-12 text-secondary">
              No people found in this department.
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6 py-6">
              {shownDeptMembers.map((person) => (
                <DeptMemberCard key={person.user_id} person={person} />
              ))}
            </div>
          )
        )}

        {/* Full Entra reporting tree */}
        {!loading && !error && !isDeptView && roots.length === 0 && (
          <div className="text-center py-16 text-secondary">
            No hierarchy data found in Microsoft Entra ID.
          </div>
        )}

        {!loading && !error && !isDeptView && roots.length > 0 && (
          matchedIds && visibleRoots.length === 0 ? (
            <div className="text-center py-12 text-secondary">No matches.</div>
          ) : (
            <div>
              <div className="flex items-center justify-end gap-2 mb-2 px-1">
                <p className="text-xs text-secondary mr-auto hidden sm:block">
                  Ctrl + scroll to zoom · drag to pan
                </p>
                <div className="inline-flex items-center gap-0.5 rounded-lg border border-outline-variant bg-white p-0.5">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    className="w-7 h-7 text-sm font-bold text-on-surface hover:bg-surface-container-low rounded-md disabled:opacity-40"
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={zoomReset}
                    className="min-w-[2.75rem] h-7 text-[11px] font-medium text-on-surface-variant hover:bg-surface-container-low rounded-md tabular-nums"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    className="w-7 h-7 text-sm font-bold text-on-surface hover:bg-surface-container-low rounded-md disabled:opacity-40"
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
              </div>
              {/* Fixed-height viewport: zoom scales content inside; section height stays stable */}
              <div
                ref={chartScrollRef}
                className="h-[min(70vh,36rem)] overflow-auto rounded-2xl bg-white/40 border border-outline-variant/30 select-none"
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                onMouseDown={onChartMouseDown}
                onMouseMove={onChartMouseMove}
                onMouseUp={endPan}
                onMouseLeave={endPan}
              >
                {/* left-drag pans; Expand buttons are excluded from pan start */}
                <div
                  className="inline-flex justify-center min-w-full px-4 py-6"
                  style={{ zoom }}
                >
                  <div className="flex items-start gap-unit-xl">
                    {visibleRoots.map((root) => (
                      <TreeNode
                        key={root.azure_id}
                        node={root}
                        depth={0}
                        expandedIds={expandedIds}
                        toggle={toggle}
                        loadChildren={loadChildren}
                        loadingIds={loadingIds}
                        onChat={handleChat}
                        matchedIds={matchedIds}
                        query={trimmedQuery}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
