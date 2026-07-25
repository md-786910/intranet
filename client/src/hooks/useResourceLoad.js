import { useState, useEffect, useCallback, useRef } from 'react';
import { isNotFoundError, normalizeApiError } from '../utils/errorUtils';

/**
 * Load a primary resource by id. Distinguishes 404 (notFound) from other errors.
 *
 * @param {string|number|undefined|null} id
 * @param {(id: string|number) => Promise<any>} fetcher - should resolve to the entity (or throw)
 * @param {{ enabled?: boolean }} [options]
 */
export default function useResourceLoad(id, fetcher, options = {}) {
  const { enabled = true } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && id != null && id !== ''));
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(() => {
    if (!enabled || id == null || id === '') {
      setData(null);
      setLoading(false);
      setNotFound(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);

    Promise.resolve()
      .then(() => fetcherRef.current(id))
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        normalizeApiError(err);
        if (isNotFoundError(err)) {
          setNotFound(true);
          setLoadError(null);
        } else {
          setNotFound(false);
          setLoadError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  useEffect(() => {
    const cancel = reload();
    return typeof cancel === 'function' ? cancel : undefined;
  }, [reload]);

  return { data, setData, loading, notFound, loadError, reload };
}
