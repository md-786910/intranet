import React, { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { type = 'info', duration = 4000 } = {}) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove],
  );

  const success = useCallback((message, opts) => show(message, { ...opts, type: 'success' }), [show]);
  const error = useCallback((message, opts) => show(message, { ...opts, type: 'error' }), [show]);
  const info = useCallback((message, opts) => show(message, { ...opts, type: 'info' }), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, remove }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none w-[calc(100%-2rem)] sm:w-auto sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm ${
              t.type === 'success'
                ? 'bg-green-50/95 border-green-200 text-green-800'
                : t.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-800'
                : 'bg-white/95 border-gray-200 text-gray-800'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex w-2 h-2 rounded-full flex-shrink-0 ${
                t.type === 'success'
                  ? 'bg-green-500'
                  : t.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-primary'
              }`}
              aria-hidden
            />
            <p className="text-sm font-medium leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="ml-auto -mr-1 -mt-1 w-6 h-6 rounded-full flex items-center justify-center text-current opacity-50 hover:opacity-100 hover:bg-black/5 transition-all flex-shrink-0"
            >
              <span aria-hidden className="text-base leading-none">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
