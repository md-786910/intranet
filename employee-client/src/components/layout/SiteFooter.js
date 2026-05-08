import React from 'react';

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-zinc-100 bg-white mt-unit-xxl">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 sm:px-6 lg:px-8 py-6 w-full">
        <p className="text-body-sm text-zinc-500 text-center sm:text-left">
          © 2026 BrightNOW. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
          <a
            className="text-body-sm text-zinc-500 hover:text-primary transition-colors"
            href="#"
          >
            Privacy Policy
          </a>
          <a
            className="text-body-sm text-zinc-500 hover:text-primary transition-colors"
            href="#"
          >
            Contact Support
          </a>
          <a
            className="text-body-sm text-zinc-500 hover:text-primary transition-colors"
            href="#"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
