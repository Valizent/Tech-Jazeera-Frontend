/**
 * Modal — overlay dialog rendered in a portal (so ancestor overflow/z-index
 * can never clip it). Closes on backdrop click and Escape.
 *
 * Layout: a flex column capped at 90vh — the header (title + close) stays
 * pinned while the body scrolls. This is why a tall dialog (a document preview
 * with a long version list) never pushes its content off-screen.
 *
 * `size` picks the max width; default 'md' preserves every existing caller.
 * 'screen' (added for DeploymentOverviewModal's spreadsheet-style table,
 * 2026-09-17) goes further than 'full' — near-edge-to-edge width, top-aligned
 * instead of vertically centered, and a FIXED height (not just a cap) that
 * fills nearly the whole viewport regardless of how much content there is —
 * so a short table doesn't leave the dialog small and centered with dead
 * space above/below it; the content area (below) is a flex child that grows
 * to fill that fixed height, letting a caller's own inner scroll region (e.g.
 * a table with a sticky header/footer) use the space directly instead of the
 * whole dialog scrolling as one block.
 * The backdrop is the app's one intentional use of glass: a frosted scrim that
 * pushes the page back without hiding it.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  full: 'max-w-[calc(100vw-2rem)]',
  screen: 'max-w-[calc(100vw-1rem)]',
};

// 'screen' gets a FIXED height (fills the viewport regardless of content);
// every other size keeps the original max-height cap (shrinks to fit its
// own content, up to that cap).
const heightClasses = {
  screen: 'h-[calc(100vh-1.5rem)]',
};

export default function Modal({ open, onClose, title, size = 'md', closable = true, children }) {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Fixed 2026-10-06, a real QA-audit finding (U01): opening a modal never
  // moved focus into it, trapped Tab inside it, or restored focus on close —
  // a keyboard/screen-reader user could Tab straight past the dialog into
  // the (visually obscured, but not actually inert) page behind it.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const focusables = () =>
      dialogRef.current ? Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
    (focusables()[0] ?? dialogRef.current)?.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        if (closable) onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault(); // nothing to tab to — keep focus pinned on the dialog itself
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    // Lock background scroll while the dialog is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Give focus back to whatever opened the dialog — a keyboard user
      // shouldn't land back at the top of the page.
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose, closable]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center overflow-y-auto',
        size === 'screen' ? 'items-start p-2 sm:p-3' : 'p-4 sm:items-center sm:p-6'
      )}
    >
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm animate-overlay-in"
        onClick={closable ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col overflow-hidden',
          size === 'screen' ? '' : 'my-auto',
          'rounded-2xl border border-border/60 bg-surface/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 ease-out',
          heightClasses[size] || 'max-h-[90vh]',
          sizeClasses[size] || sizeClasses.md
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {closable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-border/50 hover:text-text"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
