import React, { useEffect, useMemo, useRef, useState } from 'react';
import NewsCard from '../../../components/news/NewsCard';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function LatestNews({ articles, onLoadMore, canLoadMore }) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [open, setOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const categories = useMemo(() => {
    const seen = new Map();
    (articles || []).forEach((a) => {
      const c = a.category;
      if (c && c.category_id != null && !seen.has(c.category_id)) {
        seen.set(c.category_id, c);
      }
    });
    return Array.from(seen.values());
  }, [articles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (articles || []).filter((a) => {
      if (categoryId != null && a.category?.category_id !== categoryId) return false;
      if (term) {
        const hay = `${a.title || ''} ${a.summary || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [articles, search, categoryId]);

  const activeCount = (search ? 1 : 0) + (categoryId != null ? 1 : 0);
  const clearAll = () => {
    setSearch('');
    setCategoryId(null);
  };

  if (!articles || articles.length === 0) return null;

  return (
    <section className="space-y-unit-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-unit-sm">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-tertiary-container">
            <MaterialIcon
              name="newspaper"
              className="text-tertiary text-[18px]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            />
          </span>
          <h2 className="font-h2 text-h2 text-on-surface">Latest News</h2>
          {activeCount > 0 && (
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase ml-unit-xs">
              {filtered.length} of {articles.length}
            </span>
          )}
        </div>

        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors font-body-sm font-medium ${
              open || activeCount > 0
                ? 'bg-primary-container border-primary-container text-on-primary-container'
                : 'bg-white border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'
            }`}
          >
            <MaterialIcon name="filter_list" className="text-[18px]" />
            <span className="hidden sm:inline">Filter</span>
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Filter news"
              className="absolute right-0 mt-2 w-80 bg-white border border-outline-variant rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="px-unit-md py-unit-sm border-b border-outline-variant/40 flex items-center justify-between">
                <h3 className="font-h3 text-base text-on-surface">Filter</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-on-surface-variant hover:text-on-surface rounded-full w-7 h-7 inline-flex items-center justify-center hover:bg-surface-container transition-colors"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>

              <div className="p-unit-md space-y-unit-md">
                <div>
                  <label
                    htmlFor="latest-news-search"
                    className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1.5"
                  >
                    Search
                  </label>
                  <div className="relative">
                    <MaterialIcon
                      name="search"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]"
                    />
                    <input
                      id="latest-news-search"
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Title or summary..."
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {categories.length > 0 && (
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1.5">
                      Category
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setCategoryId(null)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          categoryId == null
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-white text-on-surface-variant border-outline-variant hover:border-outline'
                        }`}
                      >
                        All
                      </button>
                      {categories.map((c) => {
                        const active = categoryId === c.category_id;
                        return (
                          <button
                            key={c.category_id}
                            type="button"
                            onClick={() => setCategoryId(c.category_id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                              active
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-white text-on-surface-variant border-outline-variant hover:border-outline'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-unit-md py-unit-sm border-t border-outline-variant/40 flex items-center justify-between bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={activeCount === 0}
                  className="text-on-surface-variant font-body-sm font-medium hover:text-on-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-unit-xl bg-surface-container-lowest border border-outline-variant rounded-2xl">
          <MaterialIcon name="filter_alt_off" className="text-outline-variant text-5xl mb-unit-sm" />
          <p className="font-h3 text-on-surface mb-1">No matches</p>
          <p className="font-body-sm text-on-surface-variant mb-unit-md">
            Try a different search or category.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-unit-md">
          {filtered.map((a) => (
            <NewsCard key={a.news_item_id} article={a} size="sm" />
          ))}
        </div>
      )}

      {/* Hide "Load More" while a filter is active — it would fetch unfiltered
          pages and confuse the result count. */}
      {canLoadMore && activeCount === 0 && (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full py-unit-sm border border-outline-variant rounded-lg font-semibold text-on-surface hover:bg-surface-container transition-colors"
        >
          View News Archive
        </button>
      )}
    </section>
  );
}
