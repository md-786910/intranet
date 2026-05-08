import React from 'react';

export default function AnnouncementMarquee({ text }) {
  if (!text) return null;

  return (
    <div className="announcement-marquee bg-primary-container/20 border-b border-primary-container/30 h-10 text-primary text-xs font-bold uppercase tracking-wider">
      <div className="announcement-text">{text}</div>
    </div>
  );
}
