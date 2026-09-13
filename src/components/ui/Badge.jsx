/**
 * Badge — small status pill. Tinted background + colored text, one variant
 * per semantic meaning; screens never invent their own pill styling.
 */
import { cn } from '../../lib/utils.js';

const variants = {
  default: 'bg-border/50 text-muted ring-1 ring-inset ring-border',
  primary: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  success: 'bg-success/10 text-success ring-1 ring-inset ring-success/20',
  warning: 'bg-warning/10 text-warning ring-1 ring-inset ring-warning/25',
  danger: 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/20',
};

export default function Badge({ variant = 'default', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm',
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
