import React from 'react';
import Skeleton from '../../components/common/Skeleton';
import LatestAnnouncements from './LatestAnnouncements';
import { useMyVertical } from '../../hooks/useMyVertical';

export default function MainContentGrid() {
  const { data, loading } = useMyVertical();
  const people = data?.people || [];
  const departments = data?.departments || [];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      {/* Left column */}
      <div className="lg:col-span-8 flex flex-col gap-gutter h-full">
        <LatestAnnouncements />

        {/* Recent Documents */}
        <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col flex-grow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-h3 text-h3">Recent Documents</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocCard color="red" badge="PDF" title="Q3 Strategy Roadmap" meta="Updated today" />
            <DocCard color="blue" badge="DOC" title="Meeting Notes" meta="2 hours ago" />
            <DocCard color="orange" badge="PPT" title="Town Hall Deck" meta="Yesterday" />
            <DocCard color="green" badge="XLS" title="Budget Review v2" meta="Oct 12" />
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="lg:col-span-4 flex flex-col gap-gutter h-full">
        {/* Key Contacts */}
        <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
          <h3 className="font-h3 text-h3 mb-6">Key Contacts</h3>
          <div className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </>
            ) : people.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant px-3 py-4">
                No colleagues in your vertical yet.
              </p>
            ) : (
              people.map((p, idx) => (
                <ContactRow
                  key={p.userId}
                  avatar={renderAvatar(p, idx)}
                  name={`${p.firstName} ${p.lastName}`.trim()}
                  role={p.jobTitle || p.departmentName || ''}
                />
              ))
            )}
          </div>
        </div>

        {/* Organisation Chart */}
        <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col flex-grow">
          <h3 className="font-h3 text-h3 mb-2">Organisation Chart</h3>
          <p className="text-body-sm text-on-surface-variant mb-6">
            Explore our leadership hierarchy and team structures across the
            organization.
          </p>
          <div className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </>
            ) : departments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant px-3 py-4">
                No departments in your vertical yet.
              </p>
            ) : (
              departments.map((d) => (
                <OrgRow
                  key={d.id}
                  name={d.name}
                  count={`${d.memberCount} Team Member${d.memberCount === 1 ? '' : 's'}`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function getInitials(firstName, lastName) {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || '?';
}

const AVATAR_VARIANTS = [
  'bg-primary-container/40 text-primary',
  'bg-secondary-container text-secondary',
];

function renderAvatar(person, idx) {
  if (person.avatarUrl) {
    return (
      <img
        alt={`${person.firstName} ${person.lastName}`.trim()}
        className="w-10 h-10 rounded-full object-cover"
        src={person.avatarUrl}
      />
    );
  }
  const variant = AVATAR_VARIANTS[idx % AVATAR_VARIANTS.length];
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${variant}`}
    >
      {getInitials(person.firstName, person.lastName)}
    </div>
  );
}

function DocCard({ color, badge, title, meta }) {
  const colors = {
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
    orange: 'bg-orange-50 text-orange-500',
    green: 'bg-green-50 text-green-500',
  };
  return (
    <div className="flex items-center gap-4 p-4 border border-zinc-50 rounded-2xl hover:border-primary-container/50 transition-all cursor-pointer bg-white">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${colors[color]}`}
      >
        {badge}
      </div>
      <div className="overflow-hidden">
        <p className="font-semibold text-body-sm truncate">{title}</p>
        <p className="text-[11px] text-zinc-400">{meta}</p>
      </div>
    </div>
  );
}

function ContactRow({ avatar, name, role }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl">
      {avatar}
      <div className="flex-grow min-w-0">
        <p className="font-semibold text-body-sm truncate">{name}</p>
        <p className="text-[11px] text-on-surface-variant truncate">{role}</p>
      </div>
      <button
        type="button"
        className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-primary hover:bg-primary-container/20 transition-colors"
      >
        Chat
      </button>
    </div>
  );
}

function OrgRow({ name, count }) {
  return (
    <div className="bg-primary-container/10 rounded-2xl p-4 flex items-center justify-between border border-primary-container/20">
      <div>
        <p className="font-semibold text-body-sm">{name}</p>
        <p className="text-[11px] text-on-surface-variant">{count}</p>
      </div>
      <button
        type="button"
        className="px-4 py-2 bg-primary-container text-on-background rounded-xl text-xs font-bold hover:bg-primary-container/80 transition-all"
      >
        View
      </button>
    </div>
  );
}
