import { useState, useEffect, useCallback } from 'react';
import { orgService, transformOrgTree } from '../services/orgService';

export function useOrgTree() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orgService.getOrgTree();
      setTree(transformOrgTree(res.data?.data));
    } catch (err) {
      setError('Failed to load organisation hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { tree, loading, error, refetch: fetchTree };
}
