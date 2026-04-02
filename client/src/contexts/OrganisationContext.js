import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { orgService, transformOrgTree } from '../services/orgService';

export const OrganisationContext = createContext(null);

export function OrganisationProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useContext(AuthContext);
  const [currentOrganisation, setCurrentOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return undefined;

    if (!isAuthenticated) {
      setCurrentOrganisation(null);
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    setLoading(true);

    orgService.getOrgTree()
      .then((res) => {
        if (!isMounted) return;
        const tree = transformOrgTree(res.data?.data);
        setCurrentOrganisation(tree[0] || null);
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentOrganisation(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated]);

  const value = useMemo(() => ({
    currentOrganisation,
    currentOrganisationId: currentOrganisation?.id || null,
    currentOrganisationName: currentOrganisation?.name || '',
    loading,
  }), [currentOrganisation, loading]);

  return (
    <OrganisationContext.Provider value={value}>
      {children}
    </OrganisationContext.Provider>
  );
}
