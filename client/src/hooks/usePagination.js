import { useState, useCallback } from 'react';

export function usePagination({ initialPage = 1, initialLimit = 10 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const resetPage = useCallback(() => setPage(1), []);

  return { page, limit, setPage, setLimit, resetPage };
}
