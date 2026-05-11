import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import TodayCard from './TodayCard';

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
            <Link
              to="/org-chart"
              className="bg-primary-container text-on-background px-5 sm:px-6 py-3 rounded-lg font-semibold text-body-md hover:bg-primary-container/80 transition-all flex items-center gap-2"
            >
              View Org Chart
              <MaterialIcon name="arrow_forward" />
            </Link>
          </div>
        </div>
      </div>

      {/* Today */}
      <TodayCard />
    </section>
  );
}
