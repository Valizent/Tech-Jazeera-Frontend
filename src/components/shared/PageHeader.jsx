/**
 * PageHeader — consistent top-of-page block: title, optional description,
 * optional action buttons. Stacks on mobile, inline on larger screens.
 *
 * `onBack`, when given, renders a plain back-arrow icon button immediately
 * to the left of the title — the "return to where I came from" affordance
 * belongs next to the page's name, not lost among unrelated action buttons
 * on the right (Edit/Delete/etc., passed via `actions`).
 */
import BackButton from './BackButton.jsx';

export default function PageHeader({ title, description, onBack, actions }) {
  return (
    <div className="relative mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-surface to-bg/50 p-6 border border-border shadow-sm">
      <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
      <div className="flex items-center gap-4">
        {onBack && (
          <BackButton onClick={onBack} />
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-text lg:text-4xl">{title}</h1>
          {description && <p className="text-sm font-medium text-muted/80 max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
