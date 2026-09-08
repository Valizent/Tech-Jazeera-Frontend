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
      <select
        id={id}
        ref={ref}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text shadow-xs transition-colors',
          // A field a viewer isn't allowed to change must look visibly
          // locked — see Input.jsx's identical rule.
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-bg/40 disabled:text-muted disabled:hover:border-border',
          error
            ? 'border-danger'
            : 'border-border hover:border-muted/50 focus:border-primary'
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
});

export default Select;
