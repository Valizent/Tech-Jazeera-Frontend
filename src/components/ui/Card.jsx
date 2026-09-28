/**
 * Card — the standard content surface. One place defines what "a panel"
 * looks like (background, border, radius, padding) for the entire app.
 */
import { cn } from '../../lib/utils.js';

export default function Card({ className, children, gradientAccent = false }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/60 bg-surface p-4 sm:p-6 shadow-sm transition-all duration-300',
        className
      )}
    >
      {gradientAccent && (
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-success opacity-90" />
      )}
      {children}
    </div>
  );
}
