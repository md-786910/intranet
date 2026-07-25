import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './Button';

/**
 * Full-main not-found within the employee shell (top nav + footer stay).
 */
export default function NotFoundState({
  pageTitle = 'Not found',
  title = 'Not found',
  description = 'This item may have been removed, or the link is out of date.',
  backTo = '/home',
  backLabel = 'Back to home',
}) {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden bg-surface-container-low">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-container/40 via-surface-container-low to-surface-container-low"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(203 213 225 / 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgb(203 213 225 / 0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <p className="text-xs font-medium uppercase tracking-wider text-outline">{pageTitle}</p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center">
        <p className="select-none text-7xl font-semibold tracking-tight text-outline-variant/50 sm:text-8xl">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-on-surface">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">{description}</p>
        <div className="mt-8">
          <Button
            size="sm"
            variant="primary"
            className="!bg-primary hover:!bg-primary/90 focus:!ring-primary"
            onClick={() => navigate(backTo)}
          >
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
