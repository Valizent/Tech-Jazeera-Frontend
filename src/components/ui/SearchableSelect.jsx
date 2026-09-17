/**
 * SearchableSelect — a themed combobox for picking ONE option from an
 * `{ value, label }` list, with type-to-filter (2026-09-16, the user's own
 * ask — a plain `<Select>` with 50+ clients was a long scroll to find one).
 * Unlike SuggestInput (free text — the typed value IS the field value),
 * this always resolves to a real option's `value` (an id) or `''`; typing
 * something matching nothing just leaves the previous selection in place on
 * blur, same as a native `<select>` never landing on a value that isn't one
 * of its own `<option>`s. Include a `{ value: '', label: '...' }` entry in
 * `options` yourself for an "All ..." / clear choice — same convention
 * every plain `<Select>` in this app already uses for its own blank option,
 * so this drops in as a straight swap.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';

export default function SearchableSelect({ label, value, onChange, options = [], placeholder, className, 'aria-label': ariaLabel }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const matches = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlight(-1);
  }, [query, open]);

  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    listRef.current.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  function selectOption(option) {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && matches[highlight]) {
        e.preventDefault();
        selectOption(matches[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)} ref={rootRef}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? '')}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text shadow-xs',
          'placeholder:text-muted/70 transition-all outline-none',
          'border-border hover:border-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-surface'
        )}
      />
      {open && matches.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          ref={listRef}
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {matches.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              // onMouseDown (not onClick) fires before the input's blur, so
              // the selection registers before the dropdown would otherwise
              // close first — same reasoning as SuggestInput's own.
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm text-text',
                i === highlight ? 'bg-primary/15 text-primary' : 'hover:bg-primary/10'
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
