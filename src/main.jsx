import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppProviders from './app/AppProviders.jsx';
import { i18nReady } from './i18n/index.js';
import './index.css';

// lib/sentry.js is a DYNAMIC import (2026-09-22, a real QA-audit finding —
// P6), not a static one, so its ~85KB SDK is a separate chunk rather than
// bloating the entry bundle every session pays for. It's still kicked off
// HERE, though — fire-and-forget, deliberately NOT awaited, so it never
// blocks the render below — because 2026-09-22's OTHER real QA-audit
// finding (the "monitoring baseline" recommendation, alongside this file's
// own i18nReady await) needs real browser performance tracing turned on
// (see lib/sentry.js's own doc comment), and that only captures anything
// meaningful if the SDK initializes near app start, not reactively the
// first time something happens to throw. ErrorBoundary.jsx's own dynamic
// import of the same module is a harmless no-op re-import once this one has
// already resolved (ES modules cache by specifier) — it stays as the
// fallback for the rare case an error is thrown before this one settles.
import('./lib/sentry.js');

// Awaited (2026-09-22, a real QA-audit finding — P6, alongside i18n/index.js's
// own doc comment) so the app never paints with an empty translation table —
// i18n now loads only the CURRENT language's dictionary via a real dynamic
// import rather than bundling both eagerly, and this is the one await that
// makes that safe. In practice this resolves well before anything else on
// the page would be ready to render (a same-bundle chunk fetched in
// parallel with every other initial asset), so there's no perceptible delay
// — just no more flash of untranslated keys.
await i18nReady;

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
