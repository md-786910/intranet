import React, { useEffect, useRef, useState } from 'react';
import { employeeService } from '../../services/employeeService';

function getOrgPath(user) {
  const primary = user.departmentMemberships?.find((m) => m.is_primary) || user.departmentMemberships?.[0];
  if (!primary) return null;
  const parts = [
    primary.department?.vertical?.officeLocation?.name,
    primary.department?.vertical?.name,
    primary.department?.name,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' › ') : null;
}

export default function ReportsToPicker({
  label, value, onChange, helpText, excludeUserId, maxRoleRank,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const trimmed = query.trim();
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = { search: trimmed, limit: 20 };
        if (maxRoleRank) params.max_role_rank = maxRoleRank;
        const res = await employeeService.listEmployees(params);
        if (cancelled) return;
        const list = res.data?.data?.employees || [];
        const filtered = excludeUserId ? list.filter((u) => u.user_id !== excludeUserId) : list;
        setResults(filtered);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, open, excludeUserId, maxRoleRank]);

  const select = (user) => {
    onChange({
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    });
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
      >
        {value ? (
          <span className="flex items-center gap-2 truncate">
            <span className="font-medium text-gray-900">{value.first_name} {value.last_name}</span>
            <span className="text-gray-500 text-xs">{value.email}</span>
          </span>
        ) : (
          <span className="text-gray-400">Select a manager…</span>
        )}
        <span className="flex items-center gap-2">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => { if (e.key === 'Enter') clear(e); }}
              className="text-gray-400 hover:text-gray-700 text-xs"
            >Clear</span>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="overflow-y-auto">
            {loading && (
              <div className="px-3 py-3 text-xs text-gray-500">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-500">No matches.</div>
            )}
            {!loading && results.map((u) => {
              const orgPath = getOrgPath(u);
              const initials = `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase();
              return (
                <button
                  type="button"
                  key={u.user_id}
                  onClick={() => select(u)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary-50/60 border-b border-gray-100 last:border-b-0 flex items-center gap-3 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{u.first_name} {u.last_name}</span>
                      {u.profile?.roleCategory?.name && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold border border-violet-100 flex-shrink-0">
                          {u.profile.roleCategory.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{u.email}</div>
                    {orgPath && (
                      <div className="text-[11px] text-primary-500 mt-0.5 truncate">{orgPath}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
