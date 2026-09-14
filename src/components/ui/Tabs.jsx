/**
 * Tabs — splits a page's independent panels (a review queue, a self-submit
 * form, a config panel...) into one-at-a-time views instead of one long
 * vertical stack. Fully controlled (value/onChange), like Select — Tabs
 * itself knows nothing about routing; see useTabParam below for the
 * URL-backed value most pages should actually use.
 *
 * Responsive strategy: a horizontally-scrollable tab bar at every width
 * (same overflow-x-auto idiom Table.jsx already uses for the same overflow
 * problem), not a breakpoint collapse to a <Select> — a <select> would hide
 * every non-active tab behind a closed dropdown, which is exactly wrong for
 * discovering a still-new nav pattern, and Select is a form-field primitive
 * (see its own doc comment), not a navigation one. `overflow-y-hidden` is
 * required alongside it, not decorative: per the CSS overflow spec, setting
 * only overflow-x to a non-visible value forces the OTHER axis's computed
 * value to 'auto' too, so a tab row that's even a sub-pixel taller than its
 * own shrink-wrapped height (font hinting, zoom level, OS DPI) grows a real
 * native vertical scrollbar — the stray up/down-arrow box a user once
 * reported next to this exact tab bar, root-caused by inspecting computed
 * styles rather than guessing from a screenshot.
 *
 * Content mounting: a tab's `content` isn't rendered until its first visit
 * (so page load only pays for the active tab's own queries), but once
 * visited it stays mounted (CSS `hidden`, not unmounted) for the rest of
 * the page visit — switching away and back preserves in-progress form input
 * instead of losing it. `tabs` shape: [{ key, label, content }].
 */
import { createContext, useId, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

const ActiveTabContext = createContext(null);

/**
 * URL-backed tab state via ?tab=, so a tab is bookmarkable/shareable and a
 * notification link can eventually target one directly (?tab=key) without
 * an architecture change — see docs/TABS-notes.md. Falls back to
 * `defaultKey` for a missing, stale, or (after a role change) no-longer-
 * visible tab key rather than rendering nothing.
 */
export function useTabParam(tabs, defaultKey) {
  const [searchParams, setSearchParams] = useSearchParams();
  const validKeys = tabs.map((t) => t.key);
  const requested = searchParams.get('tab');
  const value = validKeys.includes(requested) ? requested : defaultKey;

  function onChange(key) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', key);
        return next;
      },
      { replace: true }
    );
  }

  return [value, onChange];
}

export default function Tabs({ tabs, value, onChange }) {
  const idBase = useId();
  const tabRefs = useRef([]);
  // Every key ever active gets added here, during render (not an effect) —
  // an effect would mean a one-tick flash of empty content the moment a
  // brand-new tab becomes active. Set.add is idempotent, so mutating this
  // ref on every render is safe even if React re-renders without committing.
  const visitedRef = useRef(new Set());
  visitedRef.current.add(value);

  function focusAndActivate(index) {
    const wrapped = (index + tabs.length) % tabs.length;
    onChange(tabs[wrapped].key);
    tabRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(e) {
    const index = tabs.findIndex((t) => t.key === value);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAndActivate(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAndActivate(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAndActivate(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAndActivate(tabs.length - 1);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-border"
      >
        {tabs.map((tab, i) => {
          const selected = tab.key === value;
          return (
            <button
              key={tab.key}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              role="tab"
              id={`${idBase}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${idBase}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                'relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out-expo',
                selected ? 'text-primary' : 'text-muted hover:text-text'
              )}
            >
              {tab.label}
              {selected && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary animate-in fade-in zoom-in-75 duration-200" />
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        if (!visitedRef.current.has(tab.key)) return null;
        const selected = tab.key === value;
        return (
          <div
            key={tab.key}
            role="tabpanel"
            id={`${idBase}-panel-${tab.key}`}
            aria-labelledby={`${idBase}-tab-${tab.key}`}
            hidden={!selected}
            className="pt-6"
          >
            <ActiveTabContext.Provider value={value}>{tab.content}</ActiveTabContext.Provider>
          </div>
        );
      })}
    </div>
  );
}
