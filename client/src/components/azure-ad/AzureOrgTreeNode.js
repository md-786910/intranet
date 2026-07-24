import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { azureAdService } from '../../services/azureAdService';

const DEPTH_COLORS = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600',
  'bg-teal-600',   'bg-emerald-600','bg-amber-600',
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * AzureOrgTreeNode — renders one user row with tree connector lines.
 *
 * Props:
 *   user          {object}   Graph user object
 *   depth         {number}   0 = root
 *   isLast        {bool}     true when this is the last sibling (└── vs ├──)
 *   ancestorLines {bool[]}   one entry per ancestor level:
 *                            true  = that ancestor still has siblings below → draw vertical line
 *                            false = that ancestor was the last child → draw empty space
 */
export default function AzureOrgTreeNode({
  user,
  depth       = 0,
  isLast      = true,
  ancestorLines = [],
}) {
  const navigate = useNavigate();
  const [expanded,  setExpanded]  = useState(false);
  const [children,  setChildren]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [noReports, setNoReports] = useState(false);

  const color    = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const initials = getInitials(user.displayName || '?');

  async function handleToggle(e) {
    e.stopPropagation();
    if (noReports) return;

    if (expanded) { setExpanded(false); return; }
    if (children !== null) { setExpanded(true); return; }

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
    } catch {
      setError('Failed to load direct reports');
    } finally {
      setLoading(false);
    }
  }

  // ── connector line column widths ──────────────────────────────────────────
  const COL = 20; // px per ancestor level

  return (
    <div>
      {/* ── Node row ── */}
      <div
        className="flex items-center hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group py-0.5"
        onClick={() => {
          if (user.local_user_id) {
            navigate(`/users/${user.local_user_id}`);
          } else {
            navigate(`/active-directory/${user.id}`);
          }
        }}
      >
        {/* ── Ancestor vertical lines ── */}
        {ancestorLines.map((hasLine, i) => (
          <div
            key={i}
            style={{ width: COL, minWidth: COL }}
            className="self-stretch flex justify-center"
          >
            {hasLine && (
              <div className="w-px bg-gray-200 h-full" />
            )}
          </div>
        ))}

        {/* ── Branch corner (only for non-root nodes) ── */}
        {depth > 0 && (
          <div
            style={{ width: COL, minWidth: COL }}
            className="self-stretch flex flex-col items-center"
          >
            {/* Top half — vertical line (always present to connect to parent) */}
            <div className="w-px bg-gray-200 flex-1" style={{ maxHeight: '50%' }} />
            {/* Elbow — horizontal stub */}
            <div className="flex items-center w-full" style={{ height: 20 }}>
              <div className="w-px bg-gray-200 self-stretch" />
              <div className="h-px bg-gray-200 flex-1" />
            </div>
            {/* Bottom half — continue vertical if NOT last */}
            {!isLast ? (
              <div className="w-px bg-gray-200 flex-1" />
            ) : (
              <div className="flex-1" />
            )}
          </div>
        )}

        {/* ── Expand / collapse toggle ── */}
        <button
          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mx-1 text-gray-400 transition-colors ${
            noReports
              ? 'opacity-0 pointer-events-none'
              : 'hover:text-gray-600 hover:bg-gray-200'
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
              className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* ── Avatar ── */}
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {initials}
        </div>

        {/* ── Info ── */}
        <div className="min-w-0 flex-1 ml-2.5 py-1.5">
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
          <p className="text-xs text-gray-500 truncate">
            {[user.jobTitle, user.department].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* ── Email ── */}
        <span className="text-xs text-gray-400 hidden lg:block truncate max-w-[220px] mr-4">
          {user.mail || user.userPrincipalName}
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-xs text-red-500 ml-16 pb-1">{error}</p>
      )}

      {/* ── Children ── */}
      {expanded && children && children.map((child, idx) => (
        <AzureOrgTreeNode
          key={child.id}
          user={child}
          depth={depth + 1}
          isLast={idx === children.length - 1}
          ancestorLines={[...ancestorLines, !isLast]}
        />
      ))}
    </div>
  );
}
