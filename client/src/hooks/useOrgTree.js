import { useState, useEffect, useCallback } from 'react';
import { orgService, transformOrgTree } from '../services/orgService';

export function useOrgTree() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orgService.getOrgTree();
      const org = res.data?.data;
      setTree(transformOrgTree(org));
    } catch (err) {
      setError('Failed to load organisation hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { tree, loading, error, refetch: fetch };
}
