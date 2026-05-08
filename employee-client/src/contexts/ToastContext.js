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
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-md text-sm font-medium border ${
              t.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : t.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
