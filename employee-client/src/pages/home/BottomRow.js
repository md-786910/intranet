import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Skeleton from '../../components/common/Skeleton';
import { quickLinksService } from '../../services/quickLinksService';
import { homeActivityService } from '../../services/homeActivityService';
import { iconForQuickLink } from './quickLinkIcon';
import { useContentRefresh } from '../../contexts/ContentRefreshContext';

// Compact relative-time formatter — co-located here rather than a util
// file since the only caller is this widget.
function relativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BottomRow() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      <RecentActivityCard />
      <QuickLinksCard />
    </section>
  );
}

function RecentActivityCard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { any } = useContentRefresh();

  useEffect(() => {
    let cancelled = false;
    homeActivityService.list()
      .then((res) => {
        if (cancelled) return;
        setEvents(res.data?.data?.events || []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [any]);

  return (
    <div className="lg:col-span-8 bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-unit-lg border-b border-zinc-100 flex justify-between items-center">
        <h3 className="font-h3 text-h3">Recent Activity</h3>
      </div>
      {loading ? (
        <div className="divide-y divide-zinc-50 flex-grow">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-6 flex items-center gap-5">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="flex-grow space-y-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-12 text-body-sm text-on-surface-variant">
          No recent activity yet.
        </div>
      ) : (
        // Cap the visible height at ~3 rows; overflow scrolls inside the card
        // so the rest of the home grid stays anchored.
        <ul className="divide-y divide-zinc-50 flex-grow max-h-72 overflow-y-auto">
          {events.map((event, idx) => (
            <li key={`${event.kind}-${event.timestamp}-${idx}`}>
              <ActivityRow
                iconBg={event.iconBg}
                iconColor={event.iconColor}
                icon={event.icon}
                title={event.title}
                description={event.description}
                timestamp={relativeTime(event.timestamp)}
                link={event.link}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickLinksCard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    quickLinksService
      .list()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || [];
        setLinks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="lg:col-span-4 bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
      <h3 className="font-h3 text-h3 mb-6">Quick Links</h3>

      {loading ? (
        <ul className="space-y-3 flex-grow">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className="h-11 rounded-xl" />
            </li>
          ))}
        </ul>
      ) : links.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-4">
          No quick links yet.
        </p>
      ) : (
        <ul className="space-y-3 flex-grow">
          {links.map((link) => (
            <li key={link.quick_link_id}>
              <QuickLinkAnchor link={link} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickLinkAnchor({ link }) {
  const icon = iconForQuickLink(link.label);
  const isExternal = /^https?:\/\//i.test(link.url);
  const className =
    'flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-xl transition-colors border border-zinc-50';

  // Internal paths (starting with "/") use React Router's <Link>; external URLs
  // open in a new tab.
  if (isExternal) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <MaterialIcon name={icon} className="text-primary text-sm" />
        <span className="font-medium text-body-sm">{link.label}</span>
      </a>
    );
  }
  return (
    <Link to={link.url} className={className}>
      <MaterialIcon name={icon} className="text-primary text-sm" />
      <span className="font-medium text-body-sm">{link.label}</span>
    </Link>
  );
}

function ActivityRow({ iconBg, iconColor, icon, title, description, timestamp, link }) {
  const body = (
    <div className="p-6 hover:bg-zinc-50 transition-colors flex items-center gap-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
        <MaterialIcon name={icon} />
      </div>
      <div className="flex-grow min-w-0">
        <p className="font-body-md font-semibold text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant truncate">{description}</p>
      </div>
      <span className="text-body-sm text-zinc-400 flex-shrink-0">{timestamp}</span>
    </div>
  );
  return link ? <Link to={link} className="block">{body}</Link> : body;
}
