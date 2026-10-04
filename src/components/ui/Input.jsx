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
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordField = type === 'password';
  const currentType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

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
      <div className="relative w-full">
        <input
          id={id}
          ref={ref}
          type={currentType}
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
            if (currentType === 'number') e.currentTarget.blur();
            onWheel?.(e);
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text shadow-sm ring-1 ring-border/20 transition-all outline-none',
            // A field a viewer isn't allowed to change (e.g. Marketing
            // Manager looking at Office Secretary's already-submitted
            // details) must look visibly locked, not just silently reject
            // keystrokes — same reasoning as Textarea/Select's identical rule.
            'disabled:cursor-not-allowed disabled:border-border disabled:bg-bg/60 disabled:text-muted disabled:hover:border-border',
            error
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
              : 'border-border/80 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20',
            isPasswordField && 'pr-10'
          )}
          {...props}
        />
        {isPasswordField && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-text focus:text-primary focus:outline-none"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
