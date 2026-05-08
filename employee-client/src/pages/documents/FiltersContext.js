import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Filter state shared between the documents page header (FilterPopover) and
// the visible content surfaces (CategoryGrid on /documents,
// CategoryDocList on /documents/categories/:id).
const DEFAULT_FILTERS = {
  search: '',
  categoryIds: [],
  priorities: [],
  fileTypes: [],
};

const FiltersContext = createContext({
  filters: DEFAULT_FILTERS,
  setFilters: () => {},
  resetFilters: () => {},
  activeCount: 0,
  // `availableDimensions` lets pages opt-out of dimensions that don't apply
  // (e.g. category chips on the category-detail page, where we're already
  // scoped to one category).
  availableDimensions: { search: true, categoryIds: true, priorities: true, fileTypes: true },
});

export function FiltersProvider({ children, availableDimensions }) {
  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);

  const setFilters = useCallback((next) => {
    setFiltersState((prev) => (typeof next === 'function' ? next(prev) : { ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.categoryIds.length > 0 ? 1 : 0) +
    (filters.priorities.length > 0 ? 1 : 0) +
    (filters.fileTypes.length > 0 ? 1 : 0);

  const dims = useMemo(
    () => ({ search: true, categoryIds: true, priorities: true, fileTypes: true, ...(availableDimensions || {}) }),
    [availableDimensions],
  );

  const value = useMemo(
    () => ({ filters, setFilters, resetFilters, activeCount, availableDimensions: dims }),
    [filters, setFilters, resetFilters, activeCount, dims],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useDocumentsFilters() {
  return useContext(FiltersContext);
}
