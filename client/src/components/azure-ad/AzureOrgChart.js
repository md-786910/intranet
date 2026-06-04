import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { azureAdService } from '../../services/azureAdService';

const TOP_COLORS = [
  '#6366f1', '#8b5cf6', '#0ea5e9',
  '#14b8a6', '#10b981', '#f59e0b',
];

const AVATAR_BG = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600',
  'bg-teal-600', 'bg-emerald-600', 'bg-amber-600',
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function OrgCard({ user, depth, onNavigate }) {
  const color = TOP_COLORS[depth % TOP_COLORS.length];
  const avatarBg = AVATAR_BG[depth % AVATAR_BG.length];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow w-44 shrink-0"
      style={{ borderTop: `3px solid ${color}` }}
      onClick={() => onNavigate(user.id)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {getInitials(user.displayName || '?')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {user.displayName}
          </p>
          <p className="text-xs text-gray-500 truncate leading-tight mt-0.5">
            {user.jobTitle || user.department || user.userPrincipalName || ''}
          </p>
        </div>
        {user.accountEnabled === false && (
          <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" title="Disabled" />
        )}
      </div>
    </div>
  );
}

function ToggleBtn({ expanded, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors shadow-sm z-10 text-sm font-bold leading-none"
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      {loading ? (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
        </svg>
      ) : expanded ? '−' : '+'}
    </button>
  );
}

function ChildrenRow({ nodes, depth, pathIds, autoExpand }) {
  const wrapRef = useRef(null);
  const barRef = useRef(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const bar = barRef.current;
    if (!wrap || !bar) return undefined;

    const updateBar = () => {
      const items = Array.from(wrap.querySelectorAll(':scope > ul > li'));
      if (items.length < 2) {
        bar.style.display = 'none';
        return;
      }

      const wrapRect = wrap.getBoundingClientRect();
      const firstRect = items[0].getBoundingClientRect();
      const lastRect = items[items.length - 1].getBoundingClientRect();
      const parentX = wrapRect.width / 2;

      const firstCenter = firstRect.left + firstRect.width / 2 - wrapRect.left;
      const lastCenter = lastRect.left + lastRect.width / 2 - wrapRect.left;

      // Include the parent stem in the span so the line stays connected even
      // when one expanded branch becomes wider than the others.
      const left = Math.min(firstCenter, parentX);
      const right = Math.max(lastCenter, parentX);

      bar.style.display = 'block';
      bar.style.left = `${left}px`;
      bar.style.width = `${Math.max(right - left, 0)}px`;
    };

    const frameId = requestAnimationFrame(updateBar);
    const resizeObserver = new ResizeObserver(updateBar);
    const items = Array.from(wrap.querySelectorAll(':scope > ul > li'));

    resizeObserver.observe(wrap);
    items.forEach((item) => resizeObserver.observe(item));
    window.addEventListener('resize', updateBar);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateBar);
    };
  }, [nodes]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        ref={barRef}
        className="absolute bg-gray-300"
        style={{ top: 0, height: 2, display: 'none' }}
      />

      <ul className="flex list-none m-0 p-0 gap-0">
        {nodes.map((child) => (
          <li key={child.id} className="flex flex-col items-center px-2">
            <div className="w-0.5 bg-gray-300" style={{ height: 14 }} />
            <AzureOrgChart user={child} depth={depth} pathIds={pathIds} autoExpand={autoExpand} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AzureOrgChart({ user, depth = 0, pathIds = new Set(), autoExpand = false }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noReports, setNoReports] = useState(false);
  const hasCycle = pathIds.has(user.id);

  const nextPathIds = hasCycle ? pathIds : new Set([...pathIds, user.id]);

  const loadChildren = useCallback(async ({ expandWhenLoaded = false } = {}) => {
    if (hasCycle || noReports || loading) return;
    if (children !== null) {
      if (expandWhenLoaded) setExpanded(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await azureAdService.getDirectReports(user.id);
      const reports = res.data?.data || [];
      if (reports.length === 0) {
        setNoReports(true);
      } else {
        setChildren(reports);
        if (expandWhenLoaded) setExpanded(true);
      }
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [children, hasCycle, loading, noReports, user.id]);

  useEffect(() => {
    if (hasCycle || !autoExpand || noReports || children !== null) return;
    loadChildren({ expandWhenLoaded: true });
  }, [autoExpand, children, hasCycle, loadChildren, noReports]);

  if (hasCycle) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-400 w-44">
        <span>↺</span>
        <span className="truncate">{user.displayName}</span>
        <span className="shrink-0 text-gray-300">(cycle)</span>
      </div>
    );
  }

  async function handleToggle(e) {
    e.stopPropagation();
    if (noReports) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    if (children !== null) {
      setExpanded(true);
      return;
    }

    await loadChildren({ expandWhenLoaded: true });
  }

  return (
    <div className="flex flex-col items-center">
      <OrgCard user={user} depth={depth} onNavigate={(id) => navigate(`/active-directory/${id}`)} />

      {!noReports && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 bg-gray-300" style={{ height: 14 }} />
          <ToggleBtn expanded={expanded} loading={loading} onClick={handleToggle} />
          {expanded && <div className="w-0.5 bg-gray-300" style={{ height: 14 }} />}
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {expanded && children && (
        <ChildrenRow nodes={children} depth={depth + 1} pathIds={nextPathIds} autoExpand={depth === 0 ? autoExpand : false} />
      )}
    </div>
  );
}
