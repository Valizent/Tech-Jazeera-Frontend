/**
 * Textarea — multi-line sibling of Input (labels/errors handled identically).
 */
import { forwardRef, useId, useState } from 'react';
import { cn } from '../../lib/utils.js';

// readOnly-until-interacted, not an autocomplete token — see Input.jsx's
// identical default for why (autocomplete="off"/"new-password" were both
// tried and confirmed not to stop Chrome's Address/Contact autofill).
const Textarea = forwardRef(function Textarea(
  { label, error, className, rows = 4, autoComplete = 'off', onFocus, onMouseDown, ...props },
  ref
) {
  const id = useId();
  const errorId = `${id}-error`;
  const suppressAutofill = autoComplete === 'off';
  const [locked, setLocked] = useState(suppressAutofill);

  const unlock = () => {
    if (locked) setLocked(false);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        autoComplete={autoComplete}
        readOnly={suppressAutofill ? locked : undefined}
        onMouseDown={(e) => {
          unlock();
          onMouseDown?.(e);
        }}
        onFocus={(e) => {
          unlock();
          onFocus?.(e);
        }}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text shadow-xs',
          'placeholder:text-muted/70 transition-all outline-none',
          // A field a viewer isn't allowed to change must look visibly
          // locked, not just silently reject keystrokes — see Input.jsx's
          // identical rule.
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-bg/40 disabled:text-muted disabled:hover:border-border',
          error
            ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:ring-offset-2 focus:ring-offset-surface'
            : 'border-border hover:border-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-surface'
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
});

export default Textarea;
