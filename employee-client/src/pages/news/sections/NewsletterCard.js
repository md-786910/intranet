import React, { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

// Static newsletter card — Subscribe button toasts "coming soon" until a
// real /api/v1/newsletters/subscribe endpoint exists.
export default function NewsletterCard() {
  const [email, setEmail] = useState('');
  const toast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.info('Newsletter subscriptions coming soon.');
    setEmail('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-primary-container rounded-xl p-unit-lg space-y-unit-md"
    >
      <div className="space-y-unit-xs">
        <h2 className="font-h3 text-h3 text-on-primary-container">
          Daily Briefing
        </h2>
        <p className="font-body-sm text-on-primary-container opacity-90">
          Important updates and culture news delivered every morning at 9:00 AM.
        </p>
      </div>
      <div className="space-y-unit-sm">
        <input
          className="w-full rounded-lg border-none focus:ring-2 focus:ring-primary py-2 px-4 shadow-sm text-sm"
          placeholder="work-email@brightnow.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="w-full bg-primary text-on-primary py-2 rounded-lg font-semibold shadow-sm hover:opacity-90 transition-all"
        >
          Subscribe
        </button>
      </div>
    </form>
  );
}
