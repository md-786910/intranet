import React from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../../components/common/Skeleton';
import LatestAnnouncements from './LatestAnnouncements';
import RecentDocuments from './RecentDocuments';
import { useMyVertical } from '../../hooks/useMyVertical';

export default function MainContentGrid() {
  const { data, loading } = useMyVertical();
  const navigate = useNavigate();
  const people = data?.people || [];
  const departments = data?.departments || [];
  const peopleScope = data?.peopleScope || 'DEPARTMENT';
  const peopleEmptyMessage = {
    DEPARTMENT: 'No colleagues in your department yet.',
    VERTICAL: 'No colleagues in your vertical yet.',
    OFFICE_LOCATION: 'No colleagues in your office yet.',
    ORGANISATION: 'No colleagues yet.',
  }[peopleScope] || 'No colleagues yet.';
  const departmentsScope = data?.departmentsScope || 'VERTICAL';
  const departmentsEmptyMessage = {
    DEPARTMENT: 'You’re not in a department yet.',
    VERTICAL: 'No departments in your vertical yet.',
    OFFICE_LOCATION: 'No departments in your office yet.',
    ORGANISATION: 'No departments yet.',
  }[departmentsScope] || 'No departments yet.';

  const handleChat = (userId) => {
    navigate(`/people?userId=${userId}`);
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      {/* Left column */}
      <div className="lg:col-span-8 flex flex-col gap-gutter h-full">
        <LatestAnnouncements />

        <RecentDocuments />
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
                {peopleEmptyMessage}
              </p>
            ) : (
              people.map((p, idx) => (
                <ContactRow
                  key={p.userId}
                  avatar={renderAvatar(p, idx)}
                  name={`${p.firstName} ${p.lastName}`.trim()}
                  role={p.jobTitle || p.departmentName || ''}
                  onChat={p.canChat === false ? null : () => handleChat(p.userId)}
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
          <div
            className={`space-y-3 ${departments.length > 5 ? 'max-h-[420px] overflow-y-auto pr-1 -mr-1' : ''}`}
          >
            {loading ? (
              <>
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </>
            ) : departments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant px-3 py-4">
                {departmentsEmptyMessage}
              </p>
            ) : (
              departments.map((d) => (
                <OrgRow
                  key={d.id}
                  name={d.name}
                  path={[d.officeLocationName, d.verticalName].filter(Boolean).join(' › ')}
                  count={`${d.memberCount} Team Member${d.memberCount === 1 ? '' : 's'}`}
                  onView={() => navigate(`/org-chart?dept=${encodeURIComponent(d.name)}`)}
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

function ContactRow({ avatar, name, role, onChat }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl">
      {avatar}
      <div className="flex-grow min-w-0">
        <p className="font-semibold text-body-sm truncate">{name}</p>
        <p className="text-[11px] text-on-surface-variant truncate">{role}</p>
      </div>
      {onChat && (
        <button
          type="button"
          onClick={onChat}
          className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-primary hover:bg-primary-container/20 transition-colors"
        >
          Chat
        </button>
      )}
    </div>
  );
}

function OrgRow({ name, path, count, onView }) {
  return (
    <div className="bg-primary-container/10 rounded-2xl p-3 flex items-center justify-between gap-3 border border-primary-container/20">
      <div className="min-w-0">
        {path && (
          <p className="text-[10px] uppercase tracking-wide text-on-surface-variant truncate">
            {path}
          </p>
        )}
        <p className="font-semibold text-body-sm truncate">{name}</p>
        <p className="text-[11px] text-on-surface-variant">{count}</p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="shrink-0 px-3 py-1.5 bg-primary-container text-on-background rounded-lg text-xs font-bold hover:bg-primary-container/80 transition-all"
      >
        View
      </button>
    </div>
  );
}
