/**
 * Input — label + field + error message as one unit, so no screen can ever
 * render a field without its label (accessibility) or forget to show its
 * validation error.
 *
 * forwardRef is required: react-hook-form's `register` works by attaching a
 * ref, so `<Input {...register('email')} />` must pass that ref through to
 * the real <input>.
 */
import { forwardRef, useId, useState } from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Neither `autocomplete="off"` nor `autocomplete="new-password"` actually
 * stops Chrome's suggestion dropdown on a field it heuristically recognizes
 * as a name/contact-shaped field (label "Name", DOM name="name") — both were
 * tried and both were confirmed, by real screenshots, to still show it.
 * That's not a bug in either value: Chrome's "Addresses and more" autofill
 * is a SEPARATE system from form-history autofill, and it deliberately
 * ignores the `autocomplete` attribute for a field it's confident about,
 * regardless of the token. No `autocomplete` value can be trusted to win
 * that fight.
 *
 * What actually works, because it doesn't ask Chrome's permission at all:
 * a genuinely `readOnly` input never gets the autofill UI attached to it in
 * the first place (Chrome only attaches suggestions to an editable field).
 * Start every default field readOnly, and drop it the instant the user
 * actually interacts with it (mousedown fires before focus; keyboard
 * tabbing fires focus directly) — indistinguishable from a normal field to
 * type into, but Chrome never sees an editable field to suggest against
 * before that. Skipped entirely whenever a caller opts into real browser/
 * password-manager autofill with its own explicit token (autoComplete=
 * "email", "current-password", "tel", etc.) — this only guards the default.
 */
const Input = forwardRef(function Input(
  { label, error, type = 'text', className, autoComplete = 'off', onFocus, onMouseDown, onWheel, ...props },
  ref
) {
  const id = useId(); // stable unique id so the label targets this input
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
      <input
        id={id}
        ref={ref}
        type={type}
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
        onWheel={(e) => {
          // A focused number input changes value on scroll by default in
          // Chrome/Firefox — surprising and easy to trigger by accident
          // just scrolling the page. Blurring (not preventDefault, which
          // would also block the page from scrolling under the cursor)
          // drops focus so the scroll passes through as a normal page
          // scroll instead.
          if (type === 'number') e.currentTarget.blur();
          onWheel?.(e);
        }}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text shadow-xs',
          'placeholder:text-muted/70 transition-all outline-none',
          // A field a viewer isn't allowed to change (e.g. Marketing
          // Manager looking at Office Secretary's already-submitted
          // details) must look visibly locked, not just silently reject
          // keystrokes — same reasoning as Textarea/Select's identical rule.
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

export default Input;
