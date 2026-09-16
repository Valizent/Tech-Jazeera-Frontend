/**
 * RouteFallback — the Suspense fallback shown in a layout's content area
 * while a lazy-loaded route's chunk is still downloading. Scoped to the
 * content area (not full-screen, unlike RequireAuth's own spinner in
 * router.jsx) since the sidebar/header are already on screen and stay
 * mounted around this.
 */
import Spinner from '../ui/Spinner.jsx';

export default function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}
