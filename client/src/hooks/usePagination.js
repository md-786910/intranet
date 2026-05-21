import { useState, useCallback } from 'react';

export function usePagination({ initialPage = 1, initialLimit = 10 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimitRaw] = useState(initialLimit);

  const resetPage = useCallback(() => setPage(1), []);

  const setLimit = useCallback((n) => {
    setLimitRaw(n);
    setPage(1);
  }, []);

  return { page, limit, setPage, setLimit, resetPage };
}
