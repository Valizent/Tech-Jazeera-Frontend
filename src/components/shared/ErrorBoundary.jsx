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
    // No error-reporting service wired up yet — this is the one place that
    // catches what would otherwise be a silent blank screen, so at minimum
    // it must reach the browser console.
    console.error('Caught by ErrorBoundary:', error, info.componentStack);
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
