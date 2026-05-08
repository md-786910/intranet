import { useEffect, useState } from 'react';
import { orgService } from '../services/orgService';

export function useMyVertical() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgService
      .getMyVertical()
      .then((res) => {
        if (cancelled) return;
        setData(res.data?.data || null);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
