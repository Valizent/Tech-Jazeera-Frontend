import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney, formatMonthYear } from '../../../lib/utils.js';

export default function MonthlyProgressWindowCard({ data }) {
  const { t } = useTranslation();
  if (!data || !Array.isArray(data)) return null;

  // Filter out months that are fully closed or don't have a target
  const activeMonths = data.filter((m) => m.hasTarget && !m.isClosed);

  if (activeMonths.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text">All Targets Met!</h3>
          <p className="mt-1 text-sm text-muted">All active deployments have been fully paid for the last 6 months.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Active Monthly Targets
        </p>
      </div>

      <div className="space-y-5">
        {activeMonths.map((m) => {
          const progress = m.target > 0 ? Math.min(m.achieved / m.target, 1) : 0;
          return (
            <div key={m.month}>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-sm font-semibold text-text">{formatMonthYear(m.month)}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-text">{formatMoney(m.achieved)}</span>
                  <span className="text-xs text-muted">/ {formatMoney(m.target)}</span>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
