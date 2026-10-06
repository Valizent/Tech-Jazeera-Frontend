/**
 * The single Axios instance — every API call in the app goes through here.
 *
 * Two security-critical behaviors live in this file:
 *
 * 1. ACCESS TOKEN IN MEMORY ONLY. The token is a module-level variable —
 *    never localStorage/sessionStorage, where any XSS could read it. The
 *    cost is that a page reload loses it; the refresh cookie (httpOnly)
 *    restores the session via one /auth/refresh call on boot (AuthContext).
 *
 * 2. TRANSPARENT 401 → REFRESH → RETRY. When any request 401s (access token
 *    expired — happens every 15 min by design), the interceptor refreshes
 *    once and replays the original request. Screens never know it happened.
 *    If refresh itself fails, the session is truly over: subscribers
 *    (AuthContext) are told to drop to the login screen.
 */
import axios from 'axios';
import { API_URL } from './constants.js';

let accessToken = null;

/** Called by AuthContext after login/refresh (with null to clear). */
export function setAccessToken(token) {
  accessToken = token;
}

/** AuthContext registers here to be told when the session is unrecoverable. */
const unauthorizedSubscribers = new Set();
export function subscribeUnauthorized(callback) {
  unauthorizedSubscribers.add(callback);
  return () => unauthorizedSubscribers.delete(callback);
}

/** AuthContext registers here to receive the fresh `user` object whenever
 *  the transparent 401-refresh below succeeds (2026-09-29 fix — a real
 *  audit finding: this used to only update the access token, so an Admin
 *  granting/revoking a Section Access key or changing a login's role via
 *  PATCH /employees/:id/user/role mid-session never reached the already-
 *  logged-in user's in-memory `user.sectionAccess`/`sectionAccessWrite`/
 *  `role` — they'd see stale nav/button visibility until logout or a hard
 *  reload, even though every server-side check was already correct). */
const sessionRefreshedSubscribers = new Set();
export function subscribeSessionRefreshed(callback) {
  sessionRefreshedSubscribers.add(callback);
  return () => sessionRefreshedSubscribers.delete(callback);
}

export const api = axios.create({
  baseURL: API_URL,
  // Sends/receives the httpOnly refresh cookie. Works only because the
  // server's CORS names our exact origin — a `*` origin would break this.
  withCredentials: true,
  // Fixed 2026-10-06, a real QA-audit finding (P03): axios' own default is
  // `timeout: 0` — no timeout at all. A connection that opens but never
  // responds (a real infrastructure failure, not a 4xx/5xx) left the caller
  // awaiting forever, including the boot-time session refresh, so the whole
  // app could get stuck on a loading screen with no way out. 30s is well
  // past any normal request on this app's own API, including the largest
  // upload it allows (DOCUMENT_MAX_MB/RECEIPT_MAX_MB = 10MB) on an ordinary
  // office connection, while still being a finite, real ceiling.
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight: if five requests 401 at the same moment (a dashboard load),
// they all await ONE refresh call instead of firing five rotations.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    // /auth/* endpoints never trigger a retry: a failed login is a wrong
    // password, and a failed refresh must not recursively refresh.
    const isAuthEndpoint = config?.url?.startsWith('/auth/');

    if (response?.status === 401 && !isAuthEndpoint && !config._retried) {
      config._retried = true; // one retry per request, never loops
      try {
        refreshPromise ??= api
          .post('/auth/refresh')
          .finally(() => (refreshPromise = null));
        const { data } = await refreshPromise;
        setAccessToken(data.data.accessToken);
        if (data.data.user) sessionRefreshedSubscribers.forEach((cb) => cb(data.data.user));
        return api(config); // replay the original request
      } catch {
        setAccessToken(null);
        unauthorizedSubscribers.forEach((cb) => cb());
      }
    }
    return Promise.reject(error);
  }
);
