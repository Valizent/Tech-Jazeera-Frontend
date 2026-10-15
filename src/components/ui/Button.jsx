/**
 * Button — the one button component for the whole app. Variants cover every
 * button we'll need; no screen ever hand-styles a <button> again (that's how
 * UIs drift into inconsistency).
 */
import { cn } from '../../lib/utils.js';
import Spinner from './Spinner.jsx';

const variants = {
  primary: 'bg-gradient-to-r from-primary to-primary-hover text-white shadow-sm hover:shadow-glow border border-white/10',
  secondary: 'bg-surface/70 backdrop-blur-md text-text border border-border/60 shadow-sm hover:bg-surface hover:border-border hover:shadow',
  ghost: 'text-muted hover:bg-surface/50 hover:backdrop-blur-md hover:text-text',
  success: 'bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white shadow-sm transition-colors',
  'success-solid': 'bg-gradient-to-r from-success to-success/80 text-white shadow-sm hover:shadow-md border border-white/10',
  'danger-solid': 'bg-gradient-to-r from-danger to-danger/80 text-white shadow-sm hover:shadow-md border border-white/10',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white shadow-sm transition-colors',
  'danger-ghost': 'text-danger/70 hover:bg-danger/10 hover:text-danger',
  info: 'bg-gradient-to-r from-info to-info/80 text-white shadow-sm hover:shadow-md border border-white/10',
  soft: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white shadow-sm transition-colors',
};

/** Small outline icons for action buttons (Heroicons outline, 24x24 paths), chosen with the `icon` prop. */
const ICONS = {
  check: 'M4.5 12.75l6 6 9-13.5',
  close: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  trash:
    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  download: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const sizes = {
  lg: 'h-11 px-5 text-sm',
  md: 'h-10 px-4 text-sm', // 40px tall comfortably touch-friendly
  sm: 'h-9 px-3 text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button', // explicit: stray buttons inside forms must not submit
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-all duration-200 ease-out-expo active:scale-[0.97]',
        // Loading keeps the button's own colour (dimmed); disabled turns it flat grey, so it cannot be mistaken for a live one.
        isLoading
          ? 'pointer-events-none opacity-70'
          : 'disabled:pointer-events-none disabled:cursor-not-allowed disabled:!bg-none disabled:!bg-border/60 disabled:!text-muted/70 disabled:!border-border disabled:!shadow-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {!isLoading && icon && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon]} />
        </svg>
      )}
      {children}
    </button>
  );
}
