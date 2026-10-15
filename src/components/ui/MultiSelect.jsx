/**
 * MultiSelect — the dropdown for "pick any number of these" (approval roles, request types, staff members).
 * Closed it is one field showing what is picked as removable chips; open it is a checklist (with a search box
 * once the list is long).
 *
 * @param {object[]} items
 * @param {string[]} selected      the currently-selected ids
 * @param {(id: string) => void} onToggle
 * @param {(item: object) => string} [getId]     defaults to item._id
 * @param {(item: object) => string} [getLabel]  defaults to item.name
 * @param {string} [placeholder]
 * @param {string} [emptyMessage]
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';

const SEARCH_FROM = 8;

export default function MultiSelect({
  items,
  selected,
  onToggle,
  getId = (item) => item._id,
  getLabel = (item) => item.name,
  placeholder = 'Select…',
  emptyMessage = 'Nothing to select yet.',
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      setOpen(false);
      setQuery('');
    };
    const onMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Opened near the bottom of a scrolling modal, the list would sit out of sight: bring it into view.
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  if (!items || items.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const chosen = items.filter((item) => selected.includes(getId(item)));
  const needle = query.trim().toLowerCase();
  const shown = needle ? items.filter((item) => getLabel(item).toLowerCase().includes(needle)) : items;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(
          'flex min-h-[2.5rem] w-full cursor-pointer items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 text-start text-sm transition-colors',
          open ? 'border-primary' : 'border-border hover:border-muted/60',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className="flex flex-1 flex-wrap gap-1.5">
          {chosen.length === 0 ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            chosen.map((item) => (
              <span key={getId(item)} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {getLabel(item)}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${getLabel(item)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(getId(item));
                    }}
                    className="leading-none hover:text-danger"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} fill="currentColor">
          <path d="M5.5 7.5 10 12l4.5-4.5-1.1-1.1L10 9.8 6.6 6.4z" />
        </svg>
      </div>

      {open && (
        <div ref={panelRef} className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
          {items.length >= SEARCH_FROM && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
          )}
          <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches.</li>}
            {shown.map((item) => {
              const id = getId(item);
              const on = selected.includes(id);
              return (
                <li key={id} role="option" aria-selected={on}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg/60">
                    <input type="checkbox" checked={on} onChange={() => onToggle(id)} className="h-4 w-4 rounded border-border accent-primary" />
                    {getLabel(item)}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
