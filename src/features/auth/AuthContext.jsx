/**
 * AuthContext — the client's single source of truth for "who is logged in".
 *
 * Session restore on page load: the access token lives only in memory, so a
 * reload wipes it. On mount we make ONE silent /auth/refresh call — the
 * httpOnly cookie (which survives reloads) either mints a fresh session or
 * fails, and `status` resolves to 'authed' or 'guest'. Route guards render a
 * spinner during the in-between 'loading' state instead of bouncing the user
 * to /login prematurely.
 *
 * The axios layer reports unrecoverable 401s via subscribeUnauthorized, so
 * an expired session anywhere in the app drops cleanly to the login screen.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken, subscribeUnauthorized } from '../../lib/axios.js';
import { loginRequest, refreshRequest, logoutRequest } from './auth.api.js';
import { useToast } from '../../components/ui/Toast.jsx';

const AuthContext = createContext(null);

/** The server now sends `sectionAccess` as `{ read: [...], write: [...] }`
 *  (see sectionAccess.service.js's getMySectionAccess) — flatten it into two
 *  top-level arrays so every existing `user.sectionAccess?.includes(key)`
 *  check (nav visibility, all over the app) keeps working unchanged and now
 *  correctly means "can read"; `user.sectionAccessWrite` is the new one for
 *  gating a create/edit/delete button. */
function normalizeUser(rawUser) {
  if (!rawUser) return rawUser;
  const { sectionAccess, ...rest } = rawUser;
  return {
    ...rest,
    sectionAccess: sectionAccess?.read ?? [],
    sectionAccessWrite: sectionAccess?.write ?? [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'guest'
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // One-shot session restore. A 401 here just means "not logged in".
    // P2-M2: a Worker restores into the ESS portal exactly like staff restore
    // into the admin shell — the router (not AuthContext) decides which shell
    // to render based on user.role.
    refreshRequest()
      .then(({ user: restoredUser, accessToken }) => {
        setAccessToken(accessToken);
        setUser(normalizeUser(restoredUser));
        setStatus('authed');
      })
      .catch(() => setStatus('guest'));

    // Axios tells us when a session dies mid-use (an API call 401'd and the
    // re-refresh failed). This only ever fires for a previously-authed user
    // — cold visitors' bootstrap failures don't go through this path — so
    // the toast can't greet a first-time visitor with "session expired".
    return subscribeUnauthorized(() => {
      toast.error('Your session has expired. Please sign in again.');
      queryClient.clear();
      setUser(null);
      setStatus('guest');
    });
  }, [toast, queryClient]);

  // Auto-logout after 12 minutes of inactivity
  useEffect(() => {
    if (status !== 'authed') return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Trigger auto-logout but use the state directly to avoid cyclic dependencies in the hook
        logoutRequest().catch(() => {});
        setAccessToken(null);
        queryClient.clear();
        setUser(null);
        setStatus('guest');
        toast.info('You have been logged out due to inactivity.');
      }, 12 * 60 * 1000); // 12 minutes
    };

    // Events that indicate the user is active
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));

    resetTimer(); // Start the timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [status, toast, queryClient]);

  const login = useCallback(async (credentials) => {
    const { user: loggedInUser, accessToken } = await loginRequest(credentials);
    // A previous session's cached queries (dashboard counts, review queues,
    // anything keyed without the acting user's id) must never leak into this
    // one — clear before the new session's own queries start populating it.
    queryClient.clear();
    setAccessToken(accessToken);
    setUser(normalizeUser(loggedInUser));
    setStatus('authed');
  }, [queryClient]);

  const logout = useCallback(async () => {
    // Server call first (kills the session row); local state clears even if
    // the network call fails — the user asked to leave, so we leave.
    await logoutRequest().catch(() => {});
    setAccessToken(null);
    // Same reasoning as login() above — nothing this session cached should
    // still be sitting in the shared QueryClient for whoever logs in next.
    queryClient.clear();
    setUser(null);
    setStatus('guest');
  }, [queryClient]);

  // Merge a partial into the in-memory user (e.g. a fresh avatarUrl after
  // upload) without a full session refresh — the server call that produced
  // the new value already has it, so there's nothing to re-fetch.
  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, updateUser }),
    [user, status, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
