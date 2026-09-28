/**
 * BackButton — the shared rounded back-arrow icon button. Used inline next
 * to a page title (see PageHeader's `onBack`) and standalone on a "record
 * not found" EmptyState fallback that has no PageHeader of its own.
 */
export default function BackButton({ onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:ring-primary/30 hover:shadow-md active:scale-95 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 transition-transform group-hover:-translate-x-0.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
