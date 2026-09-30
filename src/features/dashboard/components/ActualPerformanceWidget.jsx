/**
 * ActualPerformanceWidget — the real, closed-book companion to
 * ActiveRevenueWidget right above it (2026-09-24, a real user ask). Where
 * that card is an ESTIMATE (each active mobilisation's own profitPerMonth/
 * profitPerHour guess, for the still-in-progress current month), this one is
 * built from real data only — see deployment.service.js's
 * getActualPerformanceSummary for the full derivation.
 *
 * Redesigned 2026-09-27 (the user's own ask, from a screenshot of the old
 * Revenue/Expenses/Net-Profit-per-period layout): Expenses stands alone as
 * its own real-cost figure (unchanged basis — every Approved hours entry,
 * regardless of client payment status); Amount received + Net profit are
 * now based on money the client has ACTUALLY PAID and a Financial Manager/
 * Accounts has VERIFIED (`paymentDecisionStatus === 'Approved'` — see
 * deployment.service.js's decidePayment), not a computed revenue estimate.
 * Net profit = amountReceived − expenses. Three tiles per period (Expenses/
 * Amount-received/Net-profit × last month/this year), each with a real delta
 * against a real prior period — hidden entirely when there's no prior data
 * to compare against, never a fabricated 0%.
 *
 * A "Profit per hour" tile (net profit ÷ actualHours) lived here too until
 * the same day (the user's own follow-up ask) — removed, not hidden: it
 * divided a real, payment-timing-dependent net profit by real worked hours,
 * which swings from a large negative to a large positive purely based on
 * WHEN a payment happens to get verified, not on whether the placement is
 * actually profitable — a genuinely confusing number, unlike Mobilisation's
 * own stable rate-card `profitPerHour`. See deployment.service.js's
 * getActualPerformanceSummary for the matching server-side removal.
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
    <div className="rounded-xl border border-border/60 bg-bg/50 p-4 shadow-sm transition-all hover:border-border hover:bg-bg">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${colored ? profitClass(value) ?? 'text-text' : 'text-text'}`}>{formatMoney(value)}</p>
      {deltaPct != null && (
        <p className="mt-1 text-xs text-muted">
          <DeltaBadge pct={deltaPct} /> {deltaLabel}
        </p>
      )}
    </div>
  );
}

function PerformanceChart({ expenses, amountReceived }) {
  // Fixed 2026-09-29, a real audit finding: these two labels were hardcoded
  // English, unlike every other label in this same widget — reuses the
  // exact same keys the Tile components above already use for the same two
  // concepts, rather than inventing new ones.
  const { t } = useTranslation();
  const max = Math.max(expenses, amountReceived, 1);
  const expPct = Math.max(0, Math.min(100, (expenses / max) * 100));
  const recPct = Math.max(0, Math.min(100, (amountReceived / max) * 100));

  return (
    <div className="flex w-full flex-col justify-center space-y-4 px-2">
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>{t('staffDashboard.widgets.actualPerformance.amountReceived')}</span>
          <span>{recPct.toFixed(0)}%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-bg/50 border border-border/40 shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-success/60 to-success transition-all duration-1000" style={{ width: `${recPct}%` }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>{t('staffDashboard.widgets.actualPerformance.expenses')}</span>
          <span>{expPct.toFixed(0)}%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-bg/50 border border-border/40 shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-danger/60 to-danger transition-all duration-1000" style={{ width: `${expPct}%` }} />
        </div>
      </div>
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
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-3/5 xl:w-2/3">
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.expenses')}
              value={lastMonth.expenses}
              deltaPct={lastMonth.expensesDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
            />
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.amountReceived')}
              value={lastMonth.amountReceived}
              deltaPct={lastMonth.amountReceivedDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
            />
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.netProfit')}
              value={lastMonth.netProfit}
              deltaPct={lastMonth.netProfitDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsMonthBefore')}
              colored
            />
          </div>
          <div className="flex-1 w-full shrink-0 lg:w-2/5 xl:w-1/3">
            <PerformanceChart expenses={lastMonth.expenses} amountReceived={lastMonth.amountReceived} />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-text">{t('staffDashboard.widgets.actualPerformance.yearToDate', { year: thisYear.year })}</p>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-3/5 xl:w-2/3">
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.expenses')}
              value={thisYear.expenses}
              deltaPct={thisYear.expensesDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
            />
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.amountReceived')}
              value={thisYear.amountReceived}
              deltaPct={thisYear.amountReceivedDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
            />
            <Tile
              label={t('staffDashboard.widgets.actualPerformance.netProfit')}
              value={thisYear.netProfit}
              deltaPct={thisYear.netProfitDeltaPct}
              deltaLabel={t('staffDashboard.widgets.actualPerformance.vsLastYear')}
              colored
            />
          </div>
          <div className="flex-1 w-full shrink-0 lg:w-2/5 xl:w-1/3">
            <PerformanceChart expenses={thisYear.expenses} amountReceived={thisYear.amountReceived} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!canOpenDeployments) {
    return <Card gradientAccent>{body}</Card>;
  }

  return (
    <Link
      to="/deployments?overview=1"
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={t('staffDashboard.widgets.activeRevenue.viewDeployments')}
    >
      <Card gradientAccent className="relative transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
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
