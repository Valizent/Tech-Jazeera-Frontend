/**
 * ErrorBoundary — the top-level safety net around the router. Without this,
 * an uncaught render error anywhere in the app (a null pointer on unexpected
 * API data, a bad date, anything) unmounts the ENTIRE React tree to a blank
 * white screen for that user. Class component because React only supports
 * error boundaries via componentDidCatch/getDerivedStateFromError — there is
 * no hook equivalent.
 *
 * Sits inside AppProviders around <RouterProvider> only (not around Theme/
 * Query/Toast/Auth) — those providers are stable, and catching below them
 * means the fallback still renders themed and doesn't drop auth state for a
 * failure that was really just one page's render.
 */
import { Component } from 'react';
import Button from '../ui/Button.jsx';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Always reaches the browser console (works with zero setup); also
    // reported to error tracking when configured (see lib/sentry.js) —
    // this is the one place that catches what would otherwise be a silent
    // blank screen for the user.
    console.error('Caught by ErrorBoundary:', error, info.componentStack);
    // Dynamic import, not a static one (2026-09-22, a real QA-audit finding
    // — P6): this used to be the ONLY call site of lib/sentry.js's
    // captureError anywhere in the app, yet the SDK (~85KB) was statically
    // imported right here — and this component is mounted by EVERY layout
    // including the eager AuthLayout, so it shipped in an early/shared
    // chunk on every single page load, error or not. main.jsx now ALSO
    // kicks off this same import at app start (fire-and-forget, for real
    // performance tracing — see its own comment), so in practice this
    // almost always resolves instantly (ES modules cache by specifier, so
    // this is a cheap re-import of an already-settled module) — this import
    // stays as the fallback for an error thrown before that one settles,
    // and Sentry.init() (lib/sentry.js's own top-level call) always runs
    // before captureError fires below either way.
    import('../../lib/sentry.js').then(({ captureError }) => {
      captureError(error, { componentStack: info.componentStack });
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-text">Something went wrong on this screen.</h1>
          <p className="mt-2 text-sm text-muted">
            Try reloading the page. If it keeps happening, let us know what you were doing when it broke.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
