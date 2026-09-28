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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {onBack && <BackButton onClick={onBack} />}
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-text">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
