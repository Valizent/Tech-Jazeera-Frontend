/**
 * ThemeContext — light/dark toggle over the `.dark` token block in index.css
 * (darkMode: 'class' in tailwind.config.js). Flipping the whole app is one
 * class on <html>; this is just the switch and its persistence.
 *
 * Fixed 2026-09-15, a real QA-audit-found gap — D3: the comment here used
 * to describe a "follow the OS setting, live" default that was never
 * actually implemented (the inline script in index.html that sets the
 * initial class before first paint doesn't check prefers-color-scheme
 * either — it only ever looks at a stored explicit choice). No stored
 * preference = plain 'light', full stop; once a user toggles, that choice
 * is stuck in localStorage and applies on every later visit. The initial
 * class is already set by the inline script in index.html, before this
 * ever runs, so there's no flash.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';
const ThemeContext = createContext(null);

function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getStoredTheme() ?? 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing / storage disabled — the toggle still works for this tab, just won't persist.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
