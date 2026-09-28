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
      className={`group flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text active:scale-95 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 transition-transform group-hover:-translate-x-1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
