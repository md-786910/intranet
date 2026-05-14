import React from 'react';
import { Link } from 'react-router-dom';

// `items` is the preferred prop: an array of { announcement_item_id, title,
// priority } returned by GET /announcements/marquee. Falls back to the legacy
// `text` prop (plain string) so any caller passing a hardcoded message still
// works during rollout.
export default function AnnouncementMarquee({ items, text }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0 && !text) return null;

  return (
    <div className="announcement-marquee bg-primary-container/20 border-b border-primary-container/30 h-10 text-primary text-xs font-bold uppercase tracking-wider">
      <div className="announcement-text">
        {list.length > 0
          ? list.map((item, idx) => (
              <React.Fragment key={item.announcement_item_id}>
                <Link
                  to={`/announcements/${item.announcement_item_id}`}
                  className="hover:underline"
                >
                  {item.priority === 'URGENT' || item.priority === 'HIGH' ? '★ ' : ''}
                  {item.title}
                </Link>
                {idx < list.length - 1 && <span className="mx-3 opacity-60">•</span>}
              </React.Fragment>
            ))
          : text}
      </div>
    </div>
  );
}
