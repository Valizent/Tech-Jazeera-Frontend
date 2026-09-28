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
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white shadow-sm transition-colors',
  'danger-ghost': 'text-danger/70 hover:bg-danger/10 hover:text-danger',
};

const sizes = {
  lg: 'h-11 px-5 text-sm',
  md: 'h-10 px-4 text-sm', // 40px tall — comfortably touch-friendly
  sm: 'h-9 px-3 text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
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
        'disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
