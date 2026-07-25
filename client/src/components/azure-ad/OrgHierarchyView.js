import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import { OrgTreeNode } from './AzureOrgChart';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

function getInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OrgHierarchyView() {
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();
  const canvasRef = useRef(null);
  const drag = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0 });

  const [roots, setRoots] = useState([]);
  const [rootsLoading, setRootsLoading] = useState(true);
  const [rootUser, setRootUser] = useState(null);

  // expandedIds: which nodes show their children to the right
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [childrenById, setChildrenById] = useState({});
  const [countById, setCountById] = useState({});
  const [loadingIds, setLoadingIds] = useState(() => new Set());
  const [noReportsIds, setNoReportsIds] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const countPrefetchRef = useRef(new Set());

  // Only BrightNow user details when the Entra person is synced locally.
  const openUser = useCallback((user) => {
    if (user?.local_user_id) {
      navigate(`/users/${user.local_user_id}`);
    }
  }, [navigate]);

  const applyCount = useCallback((userId, count) => {
    setCountById((prev) => (prev[userId] === count ? prev : { ...prev, [userId]: count }));
    if (count === 0) {
      setNoReportsIds((prev) => new Set(prev).add(userId));
    }
  }, []);

  /** Prefetch report counts for visible children so Expand shows (n). */
  const prefetchCounts = useCallback(async (users) => {
    const pending = (users || []).filter(
      (u) => u?.id && !countPrefetchRef.current.has(u.id),
    );
    if (pending.length === 0) return;

    pending.forEach((u) => countPrefetchRef.current.add(u.id));

    const CONCURRENCY = 4;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        batch.map(async (u) => {
          try {
            const res = await azureAdService.getDirectReportsCount(u.id);
            const count = Number(res.data?.data?.count) || 0;
            applyCount(u.id, count);
          } catch {
            countPrefetchRef.current.delete(u.id);
          }
        }),
      );
    }
  }, [applyCount]);

  const fetchChildren = useCallback(async (userId) => {
    setLoadingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await azureAdService.getDirectReports(userId);
      const list = res.data?.data || [];
      setChildrenById((prev) => ({ ...prev, [userId]: list }));
      applyCount(userId, list.length);
      if (list.length === 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        // Load counts for the next level so Expand badges show before click
        prefetchCounts(list);
      }
      return list;
    } catch {
      showToast('Failed to load direct reports', 'error');
      return null;
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [showToast, applyCount, prefetchCounts]);

  // Load roots
  useEffect(() => {
    let cancelled = false;
    setRootsLoading(true);

    azureAdService.getOrgTreeRoots()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setRoots(list);
        if (list.length === 1) {
          setRootUser(list[0]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          showToast('Failed to load org hierarchy', 'error');
          setRoots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRootsLoading(false);
      });

    return () => { cancelled = true; };
  }, [showToast]);

  // Default expand 2nd level when a root is chosen
  useEffect(() => {
    if (!rootUser?.id) return undefined;
    let cancelled = false;

    setExpandedIds(new Set());
    setChildrenById({});
    setCountById({});
    setNoReportsIds(new Set());
    countPrefetchRef.current = new Set();
    setSelectedId(rootUser.id);
    setZoom(1);

    (async () => {
      const list = await fetchChildren(rootUser.id);
      if (cancelled || !list) return;
      if (list.length > 0) {
        setExpandedIds(new Set([rootUser.id]));
      }
    })();

    return () => { cancelled = true; };
  }, [rootUser, fetchChildren]);

  const toggleExpand = useCallback(async (user) => {
    if (!user?.id) return;
    setSelectedId(user.id);

    if (expandedIds.has(user.id)) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      return;
    }

    if (!childrenById[user.id] && !noReportsIds.has(user.id)) {
      const list = await fetchChildren(user.id);
      if (!list || list.length === 0) return;
    } else if (noReportsIds.has(user.id)) {
      return;
    }

    setExpandedIds((prev) => new Set(prev).add(user.id));
  }, [expandedIds, childrenById, noReportsIds, fetchChildren]);

  const selectRoot = (user) => {
    setRootUser(user);
  };

  const clearRoot = () => {
    setRootUser(null);
    setExpandedIds(new Set());
    setChildrenById({});
    setCountById({});
    setNoReportsIds(new Set());
    countPrefetchRef.current = new Set();
    setSelectedId(null);
  };

  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10)),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10)),
    [],
  );
  const zoomReset = () => setZoom(1);

  // Native non-passive wheel listener so Ctrl/Cmd+wheel can preventDefault
  // (React's onWheel is passive and cannot stop browser page-zoom).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !rootUser) return undefined;

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
  }, [rootUser]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input')) return;
    const el = canvasRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      x: e.pageX,
      y: e.pageY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    e.preventDefault();
    const el = canvasRef.current;
    if (!el) return;
    el.scrollLeft = drag.current.sl - (e.pageX - drag.current.x);
    el.scrollTop = drag.current.st - (e.pageY - drag.current.y);
  };

  const onMouseUp = () => {
    drag.current.active = false;
    setIsDragging(false);
  };

  const reportCount = rootUser
    ? (countById[rootUser.id] ?? childrenById[rootUser.id]?.length ?? null)
    : null;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - 13rem)' }}
    >
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-gray-700">Reporting Hierarchy</p>
          <div className="flex items-center gap-2">
            {rootUser && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  className="w-7 h-7 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-40"
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={zoomReset}
                  className="min-w-[3rem] h-7 text-[11px] font-medium text-gray-600 hover:bg-gray-50 rounded-md tabular-nums"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  className="w-7 h-7 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-40"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 hidden sm:block">
              Expand grows right · drag or scroll · Ctrl+scroll to zoom
            </p>
          </div>
        </div>

        {rootUser && (
          <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Hierarchy path">
            <button
              type="button"
              onClick={clearRoot}
              className="text-primary-600 hover:text-primary-800 font-medium"
            >
              Roots
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-semibold truncate max-w-[200px]">
              {rootUser.displayName}
            </span>
            {reportCount != null && (
              <span className="text-gray-400 ml-2 tabular-nums">
                · {reportCount} direct report{reportCount === 1 ? '' : 's'} (level 2 open)
              </span>
            )}
          </nav>
        )}
      </div>

      {rootsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : roots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No hierarchy data found
        </div>
      ) : !rootUser ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4">
          <p className="text-sm text-gray-600 mb-3">
            Select a root manager — their direct reports open automatically (level 2)
          </p>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {roots.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => selectRoot(user)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {getInitials(user.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[user.jobTitle, user.department].filter(Boolean).join(' · ')
                        || user.mail
                        || user.userPrincipalName
                        || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-primary-600 font-medium shrink-0">Open tree</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="flex-1 overflow-auto min-h-0 select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* CSS zoom keeps scrollbars accurate (Chromium / Edge). */}
          <div className="inline-block min-w-full p-8" style={{ zoom }}>
            <OrgTreeNode
              user={rootUser}
              depth={0}
              isRoot
              pathIds={new Set()}
              expandedIds={expandedIds}
              childrenById={childrenById}
              countById={countById}
              loadingIds={loadingIds}
              noReportsIds={noReportsIds}
              selectedId={selectedId}
              onToggleExpand={toggleExpand}
              onOpenUser={openUser}
            />
          </div>
        </div>
      )}
    </div>
  );
}
