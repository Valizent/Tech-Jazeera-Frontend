/**
 * SemiAnnualTargetCard (2026-09-27) — a coordinator's rolling 6-month real-
 * revenue progress, alongside their monthly MobilisationTargetCard. Simpler
 * than that card on purpose (no ring/confetti) — this is a slower-moving,
 * background figure, not the thing a coordinator checks daily. Renders
 * nothing when `data` is null (no target set anywhere in the window — same
 * "widget hides itself" convention as the monthly card).
 */
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney } from '../../../lib/utils.js';

export default function SemiAnnualTargetCard({ data }) {
  const { t } = useTranslation();
  if (!data) return null;

  const { windowMonths, semiAnnualTarget, achieved, excess, incentivePercent, incentiveAmount, hit } = data;
  const progress = semiAnnualTarget > 0 ? Math.min(achieved / semiAnnualTarget, 1) : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('staffDashboard.semiAnnual.title', { start: windowMonths[0], end: windowMonths[windowMonths.length - 1] })}
        </p>
        {hit && (
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
            {t('staffDashboard.semiAnnual.hitBadge')}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-text">{formatMoney(achieved)}</span>
        <span className="text-sm text-muted">/ {formatMoney(semiAnnualTarget)}</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {hit && excess > 0 && incentivePercent > 0 && (
        <p className="mt-3 text-sm font-medium text-success">
          {t('staffDashboard.semiAnnual.incentiveEarned', { amount: formatMoney(incentiveAmount), percent: incentivePercent })}
        </p>
      )}
    </Card>
  );
}
