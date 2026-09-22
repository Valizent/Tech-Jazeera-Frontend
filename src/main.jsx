import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppProviders from './app/AppProviders.jsx';
// lib/sentry.js is no longer imported here (2026-09-22, a real QA-audit
// finding — P6): ErrorBoundary.jsx now loads it dynamically, the only real
// call site — see its own doc comment. Sentry.init() still runs (as
// lib/sentry.js's own top-level side effect) the moment that first import
// resolves, so error tracking is unaffected; this file just no longer pays
// for the ~130KB SDK on every load.
import { i18nReady } from './i18n/index.js';
import './index.css';

// Awaited (2026-09-22, a real QA-audit finding — P6, alongside i18n/index.js's
// own doc comment) so the app never paints with an empty translation table —
// i18n now loads only the CURRENT language's dictionary via a real dynamic
// import rather than bundling both eagerly, and this is the one await that
// makes that safe. In practice this resolves well before anything else on
// the page would be ready to render (a same-bundle chunk fetched in
// parallel with every other initial asset), so there's no perceptible delay
// — just no more flash of untranslated keys.
await i18nReady;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
);

// PWA installability. Registration only succeeds on HTTPS (or localhost,
// which counts as a secure context for dev) — silently no-ops elsewhere
// rather than failing the app.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
