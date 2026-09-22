/**
 * Error tracking (self-hosted GlitchTip, Sentry-protocol-compatible) —
 * optional: silently does nothing if VITE_SENTRY_DSN isn't set at build
 * time, same "never block the app over a monitoring feature" posture the
 * server side follows.
 *
 * SECURITY: `sendDefaultPii: false` stops the SDK from attaching cookies/IP.
 * No `Sentry.setUser()` call anywhere in this app — crash reports carry no
 * identifying information, on purpose.
 *
 * Performance tracing (2026-09-22, a real QA-audit finding — the
 * "monitoring baseline" recommendation): real page-load/navigation/
 * interaction timing, not just exception reports, so a slowdown can be
 * measured instead of guessed at from crash reports alone. `tracesSampleRate:
 * 0.2` — a deliberately privacy-conscious partial sample (not 1.0/every
 * page view) matching the audit's own "privacy-conscious performance
 * baseline" framing; still gives a statistically real p50/p95 without
 * tracing every single session. The plain `browserTracingIntegration()`
 * (not the react-router-v7-specific variant) is used on purpose — the
 * router-aware version needs `router.jsx` itself wrapped
 * (`wrapCreateBrowserRouterV7`), a real change to the app's most complex
 * file for route-pattern-named transactions instead of URL-named ones; this
 * still captures real page-load/resource/web-vitals timing without touching
 * routing at all, and can be upgraded later if route-level breakdowns turn
 * out to matter.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

/** Report a genuine bug — a no-op if VITE_SENTRY_DSN isn't configured. */
export function captureError(error, extra) {
  if (!dsn) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
