import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { appSettingsService } from '../services/appSettingsService';

const DEFAULT_NAME = 'BrightNow';
const DEFAULT_META = 'BrightNOW';

const AppBrandingContext = createContext(null);

export function AppBrandingProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [applicationName, setApplicationName] = useState(DEFAULT_NAME);
  const [metaTitle, setMetaTitle] = useState(DEFAULT_META);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await appSettingsService.get();
      const data = res.data?.data || {};
      setApplicationName(data.application_name?.trim() || DEFAULT_NAME);
      setMetaTitle(data.meta_title?.trim() || DEFAULT_META);
    } catch {
      // Keep defaults / last known
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setApplicationName(DEFAULT_NAME);
      setMetaTitle(DEFAULT_META);
      return;
    }
    refresh();
  }, [authLoading, isAuthenticated, refresh]);

  const value = useMemo(
    () => ({
      applicationName,
      metaTitle,
      loading,
      refresh,
    }),
    [applicationName, metaTitle, loading, refresh],
  );

  return (
    <AppBrandingContext.Provider value={value}>
      {children}
    </AppBrandingContext.Provider>
  );
}

export function useAppBranding() {
  const ctx = useContext(AppBrandingContext);
  if (!ctx) {
    return {
      applicationName: DEFAULT_NAME,
      metaTitle: DEFAULT_META,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
