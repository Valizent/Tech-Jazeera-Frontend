/**
 * Select — native <select> styled to match Input, with label + error.
 * Native rather than a custom dropdown: keyboard/mobile behavior for free,
 * and an internal tool has no need for fancier.
 */
import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils.js';

const Select = forwardRef(function Select({ label, error, className, children, ...props }, ref) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          ref={ref}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border bg-surface ps-3 pe-7 text-sm text-text shadow-sm ring-1 ring-border/20 transition-all outline-none',
            // A field a viewer isn't allowed to change must look visibly
            // locked — see Input.jsx's identical rule.
            'disabled:cursor-not-allowed disabled:border-border disabled:bg-bg/60 disabled:text-muted disabled:hover:border-border',
            error
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
              : 'border-border/80 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
          {...props}
        >
          {children}
        </select>
        {/* Custom chevron positioned closer to text than the native arrow */}
        <svg
          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted"
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          aria-hidden="true"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
});

export default Select;
