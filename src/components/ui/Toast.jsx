/**
 * Toast system — global, ~80 lines, no library (a dependency would buy us
 * nothing but bundle size here).
 *
 * Usage anywhere below the provider:
 *   const toast = useToast();
 *   toast.success('Employee created');
 *   toast.error('Could not save');
 *
 * Renders bottom-right, stacks, auto-dismisses after 4.5s, manual × too.
 * aria-live="polite" so screen readers announce new toasts.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '../../lib/utils.js';

const ToastContext = createContext(null);

let nextId = 0;

const styles = {
  success: 'border-success/30 text-success bg-success/5',
  error: 'border-danger bg-danger text-white',
  info: 'border-border text-text',
};

const icons = {
  success: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  error: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, type, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  // Stable object so consumers can safely list `toast` in effect deps.
  const toast = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-lg',
              'animate-in slide-in-from-right-8 fade-in duration-300',
              styles[t.type]
            )}
          >
            <span className="font-bold mt-0.5">{icons[t.type]}</span>
            <p className={cn('flex-1 text-sm pt-0.5', t.type === 'error' ? 'text-white' : 'text-text')}>
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className={cn('pt-0.5 transition-colors', t.type === 'error' ? 'text-white/70 hover:text-white' : 'text-muted hover:text-text')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
