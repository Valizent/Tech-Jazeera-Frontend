/**
 * Provider stack, ordered inside-out by dependency:
 *   ThemeProvider (no deps) → QueryClientProvider (no deps) → ToastProvider →
 *   AuthProvider (may use toasts later) → RouterProvider (route guards need
 *   auth state).
 *
 * ErrorBoundary wraps only the router, not the whole stack — Theme/Query/
 * Toast/Auth are stable providers, and a real crash is almost always one
 * page's render, not theirs; catching below them keeps the fallback themed
 * and doesn't drop auth state for a failure that was really just one screen.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '../lib/queryClient.js';
import { ThemeProvider } from './ThemeContext.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import ErrorBoundary from '../components/shared/ErrorBoundary.jsx';
import { router } from './router.jsx';

export default function AppProviders() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
