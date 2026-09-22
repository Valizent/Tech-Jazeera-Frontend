/**
 * TanStack Query client — server-state cache configuration.
 *
 * Why TanStack Query at all: it replaces hand-written useEffect fetching,
 * loading flags, error flags, and cache invalidation with one declarative
 * hook per query, and gives us request de-duplication for free.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is "fresh" for 30s — navigating back to a screen inside that
      // window renders instantly from cache with no spinner and no request.
      staleTime: 30_000,
      // One retry covers a network blip; more would make real errors feel
      // like a hung app. 401s are already handled by the axios interceptor.
      retry: 1,
      // FIX (2026-09-22, a real QA-audit finding — P1: "respect 429
      // backoff"): the rate limiter sends a real `Retry-After` header (in
      // seconds) on a 429; without this, the one retry above fired after
      // TanStack Query's own default ~1s delay regardless — instant
      // re-hammering of a limit the server just said to back off from.
      // Capped at 10s: a real Retry-After during an active rate-limit
      // window is typically minutes long, and this is one bounded retry,
      // not a mechanism meant to sit and wait through a whole window — past
      // the cap, the single retry just runs a bit early and the query
      // surfaces its normal error state, same as any other failure.
      retryDelay: (attemptIndex, error) => {
        const retryAfter = Number(error?.response?.headers?.['retry-after']);
        if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
        return Math.min(1000 * 2 ** attemptIndex, 30_000); // TanStack Query's own default formula
      },
      // An internal tool doesn't need to refetch every time the user
      // alt-tabs back from WhatsApp.
      refetchOnWindowFocus: false,
    },
  },
});
