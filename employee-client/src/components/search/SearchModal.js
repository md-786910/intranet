import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import Skeleton from '../common/Skeleton';
import api from '../../config/api';
import { searchService } from '../../services/searchService';
import { loadHistory, pushHistory, clearHistory } from '../../utils/searchHistory';

const DEBOUNCE_MS = 250;

const TYPE_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'news',     label: 'News' },
  { value: 'document', label: 'Documents' },
];

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Chip ─────────────────────────────────────────────────────────────────
function Chip({ active, onClick, variant = 'default', children }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-body-sm text-body-sm transition-colors';
  const activeCls = variant === 'type'
    ? 'bg-primary text-on-primary border-primary ring-2 ring-primary/40'
    : 'bg-primary text-on-primary border-primary';
  const idle = 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-variant/40';
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? activeCls : idle}`}>
      {children}
    </button>
  );
}

// ── Result rows ──────────────────────────────────────────────────────────
function NewsRow({ item, highlighted, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl ${highlighted ? 'bg-primary-container/30' : 'hover:bg-surface-container-low'}`}
    >
      <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <MaterialIcon name="campaign" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-body-md text-body-md text-on-background truncate">{item.title}</div>
        <div className="text-body-sm text-on-surface-variant truncate">{item.summary || '—'}</div>
        <div className="mt-1 flex items-center gap-2">
          {item.category?.name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-container/30 text-primary text-label-caps">
              {item.category.name}
            </span>
          )}
          {item.published_at && (
            <span className="text-label-caps text-on-surface-variant">{formatRelative(item.published_at)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function DocumentRow({ item, highlighted, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl ${highlighted ? 'bg-primary-container/30' : 'hover:bg-surface-container-low'}`}
    >
      <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <MaterialIcon name="description" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-body-md text-body-md text-on-background truncate">{item.title}</div>
        <div className="text-body-sm text-on-surface-variant truncate">{item.summary || '—'}</div>
        <div className="mt-1 flex items-center gap-2">
          {item.category?.name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-container/30 text-primary text-label-caps">
              {item.category.name}
            </span>
          )}
          {item.published_at && (
            <span className="text-label-caps text-on-surface-variant">{formatRelative(item.published_at)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Section header ───────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <MaterialIcon name={icon} className="text-on-surface-variant text-sm" />
      <span className="text-label-caps text-on-surface-variant tracking-wide">{label}</span>
      <span className="text-label-caps text-zinc-400">·</span>
      <span className="text-label-caps text-zinc-400">{count}</span>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────
export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const reqIdRef = useRef(0);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState('all');
  const [categoryId, setCategoryId] = useState(null);
  const [results, setResults] = useState({ news: [], documents: [], contacts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const [history, setHistory] = useState(() => loadHistory());
  const [categories, setCategories] = useState([]);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setDebouncedQuery('');
    setType('all');
    setCategoryId(null);
    setResults({ news: [], documents: [], contacts: [] });
    setError(null);
    setHighlight(0);
    setHistory(loadHistory());
    // Focus shortly after the portal mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  // Debounce query → debouncedQuery.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch on debouncedQuery / type / categoryId change.
  useEffect(() => {
    if (!isOpen) return;
    if (!debouncedQuery) {
      setResults({ news: [], documents: [], contacts: [] });
      setLoading(false);
      setError(null);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    searchService.search({ q: debouncedQuery, type, category_id: categoryId, limit: 10 })
      .then((res) => {
        if (reqId !== reqIdRef.current) return; // stale
        const data = res.data?.data || {};
        const next = data.results || { news: [], documents: [], contacts: [] };
        // Never surface people/member hits in employee global search.
        setResults({ news: next.news || [], documents: next.documents || [], contacts: [] });
        setHistory(pushHistory(debouncedQuery));
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return;
        setError("Couldn't search right now. Try again in a moment.");
        setResults({ news: [], documents: [], contacts: [] });
      })
      .finally(() => {
        if (reqId !== reqIdRef.current) return;
        setLoading(false);
      });
  }, [debouncedQuery, type, categoryId, isOpen]);

  // Lazy-load category chips when user picks News or Documents (or All).
  // Plain employees may get a 403 from /categories (it's auth-gated to
  // NEWS:EDIT / DOCUMENTS:EDIT). We swallow the error silently — chips just
  // don't render, search still works fine without them.
  useEffect(() => {
    if (!isOpen) return;
    const entityType = type === 'document' ? 'DOCUMENT' : 'NEWS';
    api.get('/categories', { params: { entity_type: entityType, limit: 50 } })
      .then((res) => setCategories(res.data?.data?.categories || []))
      .catch(() => setCategories([]));
  }, [type, isOpen]);

  // Flattened result list for keyboard navigation.
  const flatRows = useMemo(() => {
    const rows = [];
    (results.news || []).forEach((it) => rows.push({ kind: 'news', item: it }));
    (results.documents || []).forEach((it) => rows.push({ kind: 'document', item: it }));
    return rows;
  }, [results]);

  // Reset highlight when results change.
  useEffect(() => { setHighlight(0); }, [flatRows.length]);

  const handleOpen = useCallback((row) => {
    if (!row) return;
    if (row.kind === 'news')     navigate(`/news/${row.item.id}`);
    if (row.kind === 'document') navigate(`/documents?preview=${row.item.id}`);
    onClose();
  }, [navigate, onClose]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, flatRows.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleOpen(flatRows[highlight]);
    }
  }, [onClose, flatRows, highlight, handleOpen]);

  if (!isOpen) return null;

  const trimmed = query.trim();
  const isEmpty = !trimmed;
  const hasAnyResults = (results.news?.length || 0) + (results.documents?.length || 0) > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onKeyDown={onKeyDown}>
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Search"
        className="relative bg-white rounded-3xl shadow-xl w-[min(92vw,640px)] border border-zinc-100 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <MaterialIcon name="search" className="text-on-surface-variant" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search news and documents…"
            className="flex-1 bg-transparent outline-none text-body-md text-on-background placeholder:text-on-surface-variant"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="text-on-surface-variant hover:text-on-background"
              aria-label="Clear search"
            >
              <MaterialIcon name="close" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-1 inline-flex items-center justify-center text-label-caps text-on-surface-variant bg-surface-container-low rounded-md px-2 py-1"
            aria-label="Close"
          >
            Esc
          </button>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-3 border-b border-zinc-100 flex flex-wrap items-center gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={type === opt.value}
              variant="type"
              onClick={() => { setType(opt.value); setCategoryId(null); }}
            >
              {opt.label}
            </Chip>
          ))}
          {categories.length > 0 && (
            <>
              <span className="text-zinc-300">|</span>
              {categories.slice(0, 8).map((c) => (
                <Chip
                  key={c.category_id}
                  active={categoryId === c.category_id}
                  onClick={() => setCategoryId(categoryId === c.category_id ? null : c.category_id)}
                >
                  {c.name}
                </Chip>
              ))}
            </>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-grow">
          {isEmpty && history.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-caps text-on-surface-variant tracking-wide">Recent</span>
                <button
                  type="button"
                  onClick={() => { clearHistory(); setHistory([]); }}
                  className="text-label-caps text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container-lowest text-body-sm text-on-surface-variant hover:bg-surface-variant/40"
                  >
                    <MaterialIcon name="history" className="text-on-surface-variant text-sm" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEmpty && history.length === 0 && (
            <div className="px-5 py-12 text-center text-body-sm text-on-surface-variant">
              Type to search news and documents.
            </div>
          )}

          {!isEmpty && loading && (
            <div className="px-3 py-2 space-y-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-2/5 rounded" />
                    <Skeleton className="h-3 w-3/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isEmpty && !loading && error && (
            <div className="px-5 py-12 text-center text-body-sm text-on-surface-variant">
              {error}
            </div>
          )}

          {!isEmpty && !loading && !error && !hasAnyResults && (
            <div className="px-5 py-12 text-center">
              <MaterialIcon name="search_off" className="text-on-surface-variant text-2xl" />
              <p className="text-body-sm text-on-surface-variant mt-2">No results for &ldquo;{trimmed}&rdquo;.</p>
            </div>
          )}

          {!isEmpty && !loading && !error && hasAnyResults && (
            <div className="px-2 py-2">
              {(results.news?.length || 0) > 0 && (
                <section>
                  <SectionHeader icon="campaign" label="News" count={results.news.length} />
                  <div className="space-y-1">
                    {results.news.map((item, idx) => {
                      const rowIndex = idx;
                      return (
                        <NewsRow
                          key={`n-${item.id}`}
                          item={item}
                          highlighted={highlight === rowIndex}
                          onPick={() => handleOpen({ kind: 'news', item })}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
              {(results.documents?.length || 0) > 0 && (
                <section>
                  <SectionHeader icon="description" label="Documents" count={results.documents.length} />
                  <div className="space-y-1">
                    {results.documents.map((item, idx) => {
                      const rowIndex = (results.news?.length || 0) + idx;
                      return (
                        <DocumentRow
                          key={`d-${item.id}`}
                          item={item}
                          highlighted={highlight === rowIndex}
                          onPick={() => handleOpen({ kind: 'document', item })}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-zinc-100 bg-surface-container-lowest flex items-center justify-between text-label-caps text-on-surface-variant">
          <span>Use <kbd className="px-1 py-0.5 rounded bg-white border border-zinc-200">↑</kbd>&nbsp;<kbd className="px-1 py-0.5 rounded bg-white border border-zinc-200">↓</kbd> to navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white border border-zinc-200">Enter</kbd> to open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
