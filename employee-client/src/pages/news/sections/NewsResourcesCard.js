import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

const RESOURCES = [
  { label: 'Press Kits', icon: 'open_in_new', href: '#' },
  { label: 'Brand Guidelines', icon: 'open_in_new', href: '#' },
  { label: 'Media Inquiries', icon: 'mail', href: '#' },
];

export default function NewsResourcesCard() {
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-unit-lg space-y-unit-md shadow-sm">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase">
        News Resources
      </h3>
      <nav className="flex flex-col gap-unit-sm">
        {RESOURCES.map((r) => (
          <a
            key={r.label}
            href={r.href}
            className="flex items-center justify-between group hover:text-primary transition-colors"
          >
            <span className="font-body-sm">{r.label}</span>
            <MaterialIcon name={r.icon} className="text-sm" />
          </a>
        ))}
      </nav>
    </div>
  );
}
