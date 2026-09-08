/**
 * ErrorPage — the route-level error boundary (`errorElement` in router.jsx).
 * Without this, an uncaught render/loader error anywhere in the tree falls
 * through to React Router's own default screen: a raw stack trace on a plain
 * background, with a "Hey developer" note suggesting exactly this fix.
 *
 * Distinguishes a routing error (404 — no matching path, e.g. a stale/typo'd
 * link) from a genuine thrown error (a bug) since the two need different
 * copy. The full error detail stays available via `console.error` (already
 * logged by React Router itself before this renders) and a collapsed
 * `<details>` for whoever's debugging, without putting a stack trace in
 * front of an end user by default.
 */
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';

export default function ErrorPage() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.stack || error?.message || String(error);

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger ring-1 ring-inset ring-danger/15">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold">
          {is404 ? "This page doesn't exist" : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {is404
            ? "The link you followed may be out of date, or the page may have moved."
            : "An unexpected error occurred. Reloading usually fixes it — if it keeps happening, let your Admin know."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Link to="/">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
        {!is404 && detail && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted hover:text-text">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-bg p-3 text-left text-xs text-muted">{detail}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
