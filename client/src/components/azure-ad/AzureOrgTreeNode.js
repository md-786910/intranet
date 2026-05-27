import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { azureAdService } from '../../services/azureAdService';

// Depth → ring colour for the avatar bubble
const DEPTH_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-sky-600',
  'bg-teal-600',
  'bg-emerald-600',
  'bg-amber-600',
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(depth) {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

/**
 * AzureOrgTreeNode
 *
 * Props:
 *   user        {object}  – Graph user object
 *   depth       {number}  – nesting depth (0 = root)
 *   hasChildren {bool}    – true when user.hasDirectReports hint is set
 */
export default function AzureOrgTreeNode({ user, depth = 0 }) {
  const navigate = useNavigate();
  const [expanded, setExpanded]   = useState(false);
  const [children, setChildren]   = useState(null);   // null = not loaded yet
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // We optimistically show the toggle button; if there are no reports it won't re-appear
  const [noReports, setNoReports] = useState(false);

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

    // First expand: fetch direct reports
    setLoading(true);
    setError(null);
    try {
      const res = await azureAdService.getDirectReports(user.id);
      const reports = res.data?.data || [];
      if (reports.length === 0) {
        setNoReports(true);
      } else {
        setChildren(reports);
        setExpanded(true);
      }
    } catch (err) {
      setError('Failed to load direct reports');
    } finally {
      setLoading(false);
    }
  }

  const color    = getColor(depth);
  const initials = getInitials(user.displayName || '?');
  const indent   = depth * 28; // px per level

  return (
    <div>
      {/* ── Node row ── */}
      <div
        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
        style={{ paddingLeft: `${16 + indent}px` }}
        onClick={() => navigate(`/active-directory/${user.id}`)}
      >
        {/* Expand / collapse toggle */}
        <button
          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 text-gray-400 transition-colors ${
            noReports ? 'opacity-0 pointer-events-none' : 'hover:text-gray-600 hover:bg-gray-200'
          }`}
          onClick={handleToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {loading ? (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700 transition-colors">
              {user.displayName}
            </span>
            {user.accountEnabled === false && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 shrink-0">
                Disabled
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
            {user.jobTitle && <span>{user.jobTitle}</span>}
            {user.jobTitle && user.department && <span className="text-gray-300">·</span>}
            {user.department && <span>{user.department}</span>}
          </div>
        </div>

        {/* Email */}
        <span className="text-xs text-gray-400 hidden lg:block truncate max-w-[220px]">
          {user.mail || user.userPrincipalName}
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-xs text-red-500 pl-16 pb-1">{error}</p>
      )}

      {/* ── Children ── */}
      {expanded && children && children.map((child) => (
        <AzureOrgTreeNode key={child.id} user={child} depth={depth + 1} />
      ))}
    </div>
  );
}
