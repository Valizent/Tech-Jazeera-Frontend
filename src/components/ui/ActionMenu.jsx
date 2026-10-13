/**
 * ActionMenu - one button that opens a short list of related actions (e.g. an
 * "Export" button with "Export mobilisations" / "Export deployments"), so a page
 * header does not carry one button per action. Closes on a pick, on a click
 * outside, and on Escape. `items` is `[{ key, label, onSelect, disabled }]`;
 * `isLoading` shows the button busy while an action it started is running.
 */
import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import { cn } from '../../lib/utils.js';

export default function ActionMenu({ label, items, isLoading = false, size = 'sm', variant = 'secondary' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button size={size} variant={variant} isLoading={isLoading} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <svg className={cn('ms-1.5 h-3 w-3 transition-transform', open && 'rotate-180')} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-border bg-surface p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm text-text transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
