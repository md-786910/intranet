import React from 'react';
import { useToast } from '../../../hooks/useToast';
import { FEATURED_BANNER } from '../data';

export default function FeaturedBanner() {
  const toast = useToast();
  const stub = (label) => () => toast.info(`${label} coming soon.`);
  const b = FEATURED_BANNER;

  return (
    <section className="relative h-[400px] rounded-[32px] overflow-hidden group">
      <img
        alt={b.title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        src={b.imageUrl}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-on-background/80 via-on-background/40 to-transparent flex flex-col justify-center px-6 sm:px-12 text-white">
        <span className="bg-primary-container text-on-primary-container font-label-caps text-label-caps px-3 py-1.5 rounded-full w-fit mb-6">
          {b.pill.toUpperCase()}
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-white mb-4 max-w-xl">
          {b.title}
        </h2>
        <p className="font-body-lg text-body-lg text-white/80 max-w-md mb-8">
          {b.description}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={stub('Collection access')}
            className="bg-white text-on-background px-unit-lg py-3 rounded-xl font-bold hover:bg-surface-variant transition-colors"
          >
            {b.primaryCta}
          </button>
          <button
            type="button"
            onClick={stub('Agenda download')}
            className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-unit-lg py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
          >
            {b.secondaryCta}
          </button>
        </div>
      </div>
    </section>
  );
}
