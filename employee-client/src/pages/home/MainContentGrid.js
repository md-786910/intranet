import React from 'react';
import MaterialIcon from '../../components/common/MaterialIcon';

const ELENA_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCIl5VKJKj_27mYKCFtcZ5hucYOzUqslHYclQhePulGLJ9UXUeXzkjcQLaOr8D2gi8B-yLzNhGGiGGA8L-nR-n2urUw8cD14aYlm23qxIRn7NHboAifhEnuRXzDh9I1e7ftAyEJCT5tUSlZ9I8hFc9h9VFOUOyR3E06G2JlCPqAVwY3gqFQ8LkYtetDRg7BfqgsDVGG33GJfmfsiBwxoE7XOdMWmFB41vK1x57K18Ao8VmA_gztvxuxxD6NMmSEwKZfKts0dGyK62g';
const MARCUS_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCJraYN2dJROdkNaGo4I2AUkmkYY8lTTiJYxTRovytcmq5kkQm30bDTg-hFiJ8M9IhvTFYdfhjbpANcGCPIPiME3Ic_Up_MW3NqzQlD7QTkcOntps4CvxGSrsOefJsoaYi1NouD_bh5Hbw3SUE8jWMJNSh15TAbGA6IQM0TomEeGLlbBQABDnZgf2LMdmP4wewdCga1xQXwVkLeJE1ShlhxAceP5IEBGDqjCe8AHIxnYWRA6nHz1oCCUKmsyX9ltSncxo7M6tDLnE4';

export default function MainContentGrid() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      {/* Left column */}
      <div className="lg:col-span-8 flex flex-col gap-gutter h-full">
        {/* Latest Announcements */}
        <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-h3 text-h3">Latest Announcements</h3>
            <a
              className="text-primary font-semibold text-body-sm hover:underline"
              href="#"
            >
              View all
            </a>
          </div>
          <div className="space-y-4">
            <article className="flex gap-4 p-4 border border-zinc-50 rounded-2xl hover:bg-zinc-50 transition-colors">
              <div className="w-20 h-20 bg-primary-container/20 rounded-xl flex-shrink-0 flex items-center justify-center">
                <MaterialIcon name="campaign" className="text-primary text-3xl" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Strategy
                </span>
                <h4 className="font-semibold text-body-md mt-1">
                  Q3 roadmap is available for review
                </h4>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  The leadership team has finalized the expansion roadmap for
                  the upcoming quarter.
                </p>
              </div>
            </article>
            <article className="flex gap-4 p-4 border border-zinc-50 rounded-2xl hover:bg-zinc-50 transition-colors">
              <div className="w-20 h-20 bg-primary-container/20 rounded-xl flex-shrink-0 flex items-center justify-center">
                <MaterialIcon name="brush" className="text-primary text-3xl" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Marketing
                </span>
                <h4 className="font-semibold text-body-md mt-1">
                  Marketing guidelines were refreshed
                </h4>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Updated brand kit and social media templates are now
                  available in the portal.
                </p>
              </div>
            </article>
          </div>
        </div>

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
            <ContactRow
              avatar={<img alt="Elena Rodriguez" className="w-10 h-10 rounded-full object-cover" src={ELENA_AVATAR} />}
              name="Elena Rodriguez"
              role="Director of Strategy"
            />
            <ContactRow
              avatar={<img alt="Marcus Chen" className="w-10 h-10 rounded-full object-cover" src={MARCUS_AVATAR} />}
              name="Marcus Chen"
              role="Lead Project Manager"
            />
            <ContactRow
              avatar={
                <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center text-primary font-bold text-xs">
                  JM
                </div>
              }
              name="Jordan Miller"
              role="HR Manager"
            />
            <ContactRow
              avatar={
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary font-bold text-xs">
                  SJ
                </div>
              }
              name="Sarah Jenkins"
              role="Operations Lead"
            />
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
            <OrgRow name="Marketing" count="12 Team Members" />
            <OrgRow name="Product" count="24 Team Members" />
            <OrgRow name="Operations" count="8 Team Members" />
          </div>
        </div>
      </div>
    </section>
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
      <div className="flex-grow">
        <p className="font-semibold text-body-sm">{name}</p>
        <p className="text-[11px] text-on-surface-variant">{role}</p>
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
