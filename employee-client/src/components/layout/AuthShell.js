import React from 'react';
import Logo from '../common/Logo';

// Soft pastel background with two corner blobs, centered card area, and footer
export default function AuthShell({ children, statusLine }) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Background blobs */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c7d2fe 0%, #e0e7ff 50%, transparent 75%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 w-[460px] h-[460px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, #fed7aa 0%, #ffedd5 50%, transparent 75%)' }}
      />

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-8">
          <Logo size="lg" />
        </div>

        <div className="w-full max-w-md">{children}</div>

        {statusLine && (
          <div className="mt-8 inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-gray-200 text-xs">
            <span className="flex items-center gap-1.5 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-medium">System Status:</span>
            </span>
            <span className="text-gray-600">All nodes operational</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500 font-medium">v.2.4.1</span>
          </div>
        )}
      </main>

      <footer className="relative px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
        <p>© 2026 BrightNOW. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-gray-700">Privacy Policy</a>
          <a href="#" className="hover:text-gray-700">Contact Support</a>
          <a href="#" className="hover:text-gray-700">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
