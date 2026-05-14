import React, { useMemo, useState } from 'react';

/**
 * ChatAccessSelector
 *
 * Default-allow chat reachability picker. Every candidate row renders with a
 * checkbox that starts CHECKED. Unchecking a row adds its user_id to `value`
 * (the blocklist) — those users won't appear in the employee's chat search
 * and the employee won't appear in theirs.
 *
 * Props:
 *   candidates: [{ user_id, first_name, last_name, email, primary_department_name }]
 *   value:      array of blocked user_ids
 *   onChange:   (nextBlockedIds: number[]) => void
 *   loading:    boolean
 *   excludeUserId: optional — hide a specific user from the list (self on Edit)
 */
export default function ChatAccessSelector({
  candidates = [],
  value = [],
  onChange,
  loading = false,
  excludeUserId = null,
}) {
  const [query, setQuery] = useState('');

  const blockedSet = useMemo(() => new Set((value || []).map(Number)), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (candidates || [])
      .filter((u) => !excludeUserId || Number(u.user_id) !== Number(excludeUserId))
      .filter((u) => {
        if (!q) return true;
        const haystack = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [candidates, query, excludeUserId]);

  const toggle = (userId) => {
    const id = Number(userId);
    const next = new Set(blockedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange?.(Array.from(next));
  };

  const removeBlock = (userId) => {
    onChange?.(Array.from(blockedSet).filter((id) => id !== Number(userId)));
  };

  const excludedNames = useMemo(() => {
    const byId = new Map((candidates || []).map((c) => [Number(c.user_id), c]));
    return Array.from(blockedSet)
      .map((id) => byId.get(Number(id)))
      .filter(Boolean);
  }, [blockedSet, candidates]);

  if (loading) {
    return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;
  }

  return (
    <div className="space-y-3">
      {excludedNames.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900 mb-1.5">
            Excluded from chat ({excludedNames.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {excludedNames.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => removeBlock(u.user_id)}
                className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-900 px-2 py-0.5 rounded-full hover:bg-amber-100"
              >
                {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                <span aria-hidden className="text-amber-600">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search colleagues by name or email…"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />

      <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-gray-500">
            {query ? 'No colleagues match this search.' : 'No active users found.'}
          </div>
        ) : (
          filtered.map((u) => {
            const checked = !blockedSet.has(Number(u.user_id));
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
            return (
              <label
                key={u.user_id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(u.user_id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="min-w-0 flex-grow">
                  <div className="text-sm font-medium text-gray-900 truncate">{fullName}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {u.email}
                    {u.primary_department_name ? ` · ${u.primary_department_name}` : ''}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>

      <p className="text-xs text-gray-500">
        Unchecked colleagues won't appear in this employee's chat search, and this employee won't appear in theirs.
      </p>
    </div>
  );
}
