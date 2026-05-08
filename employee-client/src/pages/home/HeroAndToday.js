import React from 'react';
import MaterialIcon from '../../components/common/MaterialIcon';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDpZVUHw_2Gm1yttBh8RWDpJryJJhYtBwKR94l6KtLLh8g22ffXNoQzSjxeEcHl9J8TJq8ojFwmtTGdoZqFVDC9EQ6YlNvpPXqgZEU0WL-h_4AcdYV7EINVaaXhHAs-qEv3_9ePxx7Qqvwz8YymbtD1trmWP3PSYjPavHtlyOrMBAF0-ybvWN58AeGHrywbA144I7sPN2Hqhy7OKZIPeQETzto8VnzPET-S9YbcESW0gH2ao6in08r9JP4Xnz7VUIIbaXy1isB6l5Y';

export default function HeroAndToday() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      {/* Hero */}
      <div className="lg:col-span-8 relative rounded-3xl overflow-hidden min-h-[320px] sm:min-h-[400px] flex items-center shadow-lg bg-zinc-50">
        <div className="absolute inset-0 z-0">
          <img
            alt="Office atmosphere"
            className="w-full h-full object-cover"
            src={HERO_IMAGE}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/40 sm:to-transparent"></div>
        </div>
        <div className="relative z-10 px-6 py-8 sm:px-unit-xl max-w-xl">
          <span className="font-label-caps text-primary bg-primary-container/30 px-3 py-1 rounded-full mb-4 inline-block">
            PORTAL UPDATE
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-display text-on-background mb-4">
            Welcome back to BrightNOW.
          </h1>
          <p className="font-body-lg text-base sm:text-lg text-secondary mb-6 sm:mb-8">
            Access your team directory, latest company news, and all essential
            HR documents in one central place.
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              className="bg-primary-container text-on-background px-5 sm:px-6 py-3 rounded-lg font-semibold text-body-md hover:bg-primary-container/80 transition-all flex items-center gap-2"
            >
              View Directory
              <MaterialIcon name="arrow_forward" />
            </button>
          </div>
        </div>
      </div>

      {/* Today */}
      <div className="lg:col-span-4 bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-unit-md">
            <span className="font-label-caps text-on-surface-variant uppercase">
              TODAY
            </span>
            <button
              type="button"
              className="text-primary hover:bg-primary-container/20 p-2 rounded-full transition-colors"
            >
              <MaterialIcon name="more_vert" />
            </button>
          </div>
          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                <MaterialIcon name="groups" />
              </div>
              <div>
                <p className="font-body-md font-semibold text-on-surface">
                  Town Hall
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  Tomorrow at 10 AM PST
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <MaterialIcon name="edit_document" />
              </div>
              <div>
                <p className="font-body-md font-semibold text-on-surface">
                  Roadmap Review
                </p>
                <p className="text-body-sm text-on-surface-variant">Due Friday</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <MaterialIcon name="verified_user" />
              </div>
              <div>
                <p className="font-body-md font-semibold text-on-surface">
                  Pending Approvals
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  3 actions waiting
                </p>
              </div>
            </li>
          </ul>
        </div>
        <a
          className="mt-8 text-primary font-semibold flex items-center gap-2 hover:underline"
          href="#"
        >
          View All
          <MaterialIcon name="arrow_forward" className="text-[18px]" />
        </a>
      </div>
    </section>
  );
}
