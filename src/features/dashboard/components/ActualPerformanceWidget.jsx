/**
 * ActualPerformanceWidget — the real, closed-book Revenue/Expenses/Net Profit
 * companion to ActiveRevenueWidget right above it (2026-09-24, a real user
 * ask). Where that card is an ESTIMATE (each active mobilisation's own
 * profitPerMonth guess, for the still-in-progress current month), this one is
 * built only from Deployment monthly-hours entries the Marketing Manager has
 * actually APPROVED — see dashboard.service.js's getActualPerformanceSummary
 * and deployment.service.js's computeMonthlyRevenueAndExpenses for the full
 * derivation. Six tiles (Revenue/Expenses/Net Profit × last month/this year),
 * each with a real delta against a real prior period — hidden entirely when
 * there's no prior data to compare against, never a fabricated 0%.
 *
 * The whole card is one Link to the Deployments register's Overview modal
 * (same `?overview=1` deep link ActiveRevenueWidget already established) —
 * that spreadsheet view is where every deployment behind these numbers is
 * actually visible, per the user's own reasoning ("because we can see those
 * data there right").
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney, profitClass } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';

function DeltaBadge({ pct }) {
  if (pct == null) return null;
  return (
    <span className={`text-xs font-medium ${pct >= 0 ? 'text-success' : 'text-danger'}`}>
      {pct >= 0 ? '+' : ''}
      {pct}%
    </span>
  );
}

function Tile({ label, value, deltaPct, deltaLabel, colored }) {
  return (
    <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${colored ? profitClass(value) ?? 'text-text' : 'text-text'}`}>{formatMoney(value)}</p>
      {deltaPct != null && (
        <p className="mt-0.5 text-xs text-muted">
          <DeltaBadge pct={deltaPct} /> {deltaLabel}
        </p>
      )}
    </div>
  );
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  // English/unlocalized deliberately — same documented scope boundary every
  // other date format in this app already follows.
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function ActualPerformanceWidget({ performance }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!performance) return null;
  const { lastMonth, thisYear } = performance;
  const canOpenDeployments = Boolean(user.sectionAccess?.includes('deploymentsRelease'));

  const body = (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.actualPerformance.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('staffDashboard.widgets.actualPerformance.hint')}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-text">{monthLabel(lastMonth.month)}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.revenue')}
            value={lastMonth.revenue}
            deltaPct={lastMonth.revenueDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
          />
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.expenses')}
            value={lastMonth.expenses}
            deltaPct={lastMonth.expensesDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
          />
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.netProfit')}
            value={lastMonth.profit}
            deltaPct={lastMonth.profitDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
            colored
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-text">{t('staffDashboard.widgets.actualPerformance.yearToDate', { year: thisYear.year })}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.revenue')}
            value={thisYear.revenue}
            deltaPct={thisYear.revenueDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
          />
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.expenses')}
            value={thisYear.expenses}
            deltaPct={thisYear.expensesDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
          />
          <Tile
            label={t('staffDashboard.widgets.actualPerformance.netProfit')}
            value={thisYear.profit}
            deltaPct={thisYear.profitDeltaPct}
            deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
            colored
          />
        </div>
      </div>
    </div>
  );

  if (!canOpenDeployments) {
    return <Card>{body}</Card>;
  }

  return (
    <Link
      to="/deployments?overview=1"
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={t('staffDashboard.widgets.activeRevenue.viewDeployments')}
    >
      <Card className="relative transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
        <svg
          className="absolute end-4 top-4 h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        {body}
      </Card>
    </Link>
  );
}
