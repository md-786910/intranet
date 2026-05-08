import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AnnouncementMarquee from './AnnouncementMarquee';
import TopNav from './TopNav';
import SiteFooter from './SiteFooter';

// TODO: replace with API-backed value (e.g. GET /api/v1/announcements/active)
const DEFAULT_ANNOUNCEMENT =
  'Global town hall tomorrow at 10 AM PST - Q3 strategy roadmap now available for review - New policy updates published - Welcome our new team members';

export default function EmployeeLayout() {
  // eslint-disable-next-line no-unused-vars
  const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);

  return (
    <div className="min-h-screen flex flex-col bg-white font-body-md antialiased">
      <div className="sticky top-0 z-50 bg-white">
        <AnnouncementMarquee text={announcement} />
        <TopNav />
      </div>
      <main className="flex-grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
