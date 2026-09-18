import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppProviders from './app/AppProviders.jsx';
import './lib/sentry.js';
import './i18n/index.js';
import './index.css';

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
