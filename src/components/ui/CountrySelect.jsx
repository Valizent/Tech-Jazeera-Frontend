/**
 * CountrySelect — a themed, searchable country combobox: type to filter,
 * click (or arrow keys + Enter) to pick, styled to match Input/Select
 * instead of the browser's own unstyled `<datalist>` popup. Stays free text
 * (the typed value IS the field value) rather than a validated enum — same
 * reasoning as countries.js's own note: a document's nationality doesn't
 * always match a UN member-state list (e.g. "Palestinian"), so this
 * suggests without restricting.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { COUNTRIES } from '../../lib/countries.js';
import { cn } from '../../lib/utils.js';

export default function CountrySelect({
  label,
  error,
  value,
  onChange,
  onBlur,
  placeholder,
  options = COUNTRIES,
  className,
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const query = value?.trim() ?? '';
  const matches = query
    ? options.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
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

  function selectCountry(country) {
    onChange(country);
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
        selectCountry(matches[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
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
        autoComplete="off"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text shadow-xs',
          'placeholder:text-muted/70 transition-all outline-none',
          error
            ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:ring-offset-2 focus:ring-offset-surface'
            : 'border-border hover:border-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-surface'
        )}
      />
      {open && matches.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          ref={listRef}
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {matches.map((country, i) => (
            <li
              key={country}
              role="option"
              aria-selected={country === value}
              // onMouseDown (not onClick) fires before the input's onBlur,
              // so the selection registers before the dropdown would
              // otherwise close first.
              onMouseDown={(e) => {
                e.preventDefault();
                selectCountry(country);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm text-text',
                i === highlight ? 'bg-primary/15 text-primary' : 'hover:bg-primary/10'
              )}
            >
              {country}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
}
