import React, { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AnnouncementMarquee from './AnnouncementMarquee';
import TopNav from './TopNav';
import SiteFooter from './SiteFooter';
import { announcementService } from '../../services/announcementService';
import { useContentRefresh } from '../../contexts/ContentRefreshContext';

const MARQUEE_POLL_MS = 30 * 1000;

export default function EmployeeLayout() {
  const [marqueeItems, setMarqueeItems] = useState([]);
  const { announcement } = useContentRefresh();

  const fetchMarquee = useCallback(async () => {
    try {
      const res = await announcementService.getMarquee();
      const items = res.data?.data?.items;
      setMarqueeItems(Array.isArray(items) ? items : []);
    } catch {
      setMarqueeItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      fetchMarquee();
    };
    run();
    const interval = setInterval(run, MARQUEE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', run);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', run);
    };
  }, [fetchMarquee]);

  // Live refresh when an announcement notification arrives over the socket.
  useEffect(() => {
    if (announcement === 0) return;
    fetchMarquee();
  }, [announcement, fetchMarquee]);

  return (
    <div className="min-h-screen flex flex-col bg-white font-body-md antialiased">
      <div className="sticky top-0 z-50 bg-white">
        <AnnouncementMarquee items={marqueeItems} />
        <TopNav />
      </div>
      <main className="flex-grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
