/**
 * StatusBreakdown — a lightweight horizontal bar chart (proportional divs, no
 * charting library — the stack is locked and this is ~20 lines). Shows each
 * status's share of the total.
 */
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils.js';

const BAR_COLOR = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
  default: 'bg-muted',
};

export default function StatusBreakdown({ title, data, colors }) {
  const { t } = useTranslation();
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    // h-full (2026-09-24): this widget always pairs in a 2-col grid with a sibling
    // that's often taller (Standby Workforce Analysis, the Coordinator Leaderboard)
    // — without it, a shorter breakdown leaves a real visible gap below its own
    // card instead of matching the row's full height (the same class of bug found
    // and fixed on DirectoryStatsWidget the same day — see its own doc comment).
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {total === 0 ? (
        <p className="text-sm text-muted">{t('staffDashboard.noDataYet')}</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(data).map(([label, count]) => {
            const pct = Math.round((count / total) * 100);
            return (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{t(`common.status.${label}`, label)}</span>
                  <span className="tabular-nums text-muted">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border/50">
                  <div
                    className={cn('h-full rounded-full', BAR_COLOR[colors[label]] ?? BAR_COLOR.default)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
