/**
 * PageHeader — consistent top-of-page block: title, optional description,
 * optional action buttons. Stacks on mobile, inline on larger screens.
 *
 * The description is an (i) button beside the title rather than a paragraph
 * under it (2026-10-14, the user's own ask), and every word of the title is
 * capitalised.
 *
 * `onBack`, when given, renders a plain back-arrow icon button immediately
 * to the left of the title — the "return to where I came from" affordance
 * belongs next to the page's name, not lost among unrelated action buttons
 * on the right (Edit/Delete/etc., passed via `actions`).
 */
import BackButton from './BackButton.jsx';
import InfoTip from '../ui/InfoTip.jsx';

export default function PageHeader({ title, description, onBack, actions }) {
  return (
    <div className="relative mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-surface to-bg/50 p-6 border border-border shadow-sm">
      <div className="absolute top-0 left-0 w-2 h-full bg-primary rounded-r-full" />
      <div className="flex items-center gap-4">
        {onBack && (
          <BackButton onClick={onBack} />
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-extrabold capitalize tracking-tight text-text lg:text-4xl">{title}</h1>
          <InfoTip text={description} />
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
