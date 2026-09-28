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
      className={`group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg border border-border text-muted transition-all duration-300 hover:bg-primary hover:text-white hover:border-primary hover:shadow-glow hover:-translate-x-1 active:scale-95 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 transition-transform">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
