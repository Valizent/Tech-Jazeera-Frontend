/**
 * Error tracking (self-hosted GlitchTip, Sentry-protocol-compatible) —
 * optional: silently does nothing if VITE_SENTRY_DSN isn't set at build
 * time, same "never block the app over a monitoring feature" posture the
 * server side follows.
 *
 * SECURITY: `sendDefaultPii: false` stops the SDK from attaching cookies/IP.
 * No `Sentry.setUser()` call anywhere in this app — crash reports carry no
 * identifying information, on purpose.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // error tracking only — no performance/tracing data
    sendDefaultPii: false,
  });
}

/** Report a genuine bug — a no-op if VITE_SENTRY_DSN isn't configured. */
export function captureError(error, extra) {
  if (!dsn) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
