import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './Button';

/**
 * Full-viewport not-found within the admin shell (sidebar/header stay).
 * Fills the main content area — not a sparse header or a hollow card.
 */
export default function NotFoundState({
  pageTitle = 'Not found',
  title = 'Not found',
  description = 'This item may have been removed, or the link is out of date.',
  backTo = '/',
  backLabel = 'Back to list',
}) {
  const navigate = useNavigate();

  return (
    <div className="relative -mx-6 -my-5 flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-gray-50">
      {/* Soft atmosphere — full-bleed, not a floating card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-50/80 via-gray-50 to-gray-50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(229 231 235 / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(229 231 235 / 0.7) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-6 pt-5">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{pageTitle}</p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 text-center">
        <p className="select-none text-7xl font-semibold tracking-tight text-gray-200 sm:text-8xl">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500">{description}</p>
        <div className="mt-8">
          <Button size="sm" variant="primary" onClick={() => navigate(backTo)}>
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
