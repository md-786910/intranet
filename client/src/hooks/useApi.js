import { useState, useCallback, useEffect } from 'react';
import { extractValidationErrors, getErrorMessage } from '../utils/errorUtils';

export function useApi(apiFn, { immediate = false, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiFn(...args);
      const result = response.data?.data ?? response.data;
      setData(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err, 'An error occurred');
      setError(message);
      
      const validationErrors = extractValidationErrors(err);
      setFieldErrors(validationErrors);
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setFieldErrors({});
    setLoading(false);
  }, [initialData]);

  useEffect(() => {
    if (immediate) execute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, fieldErrors, execute, reset };
}
