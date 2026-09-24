/**
 * ActiveRevenueWidget — the big "active mobilisation revenue" figure, now full
 * width (2026-09-24, swapped places with HrComplianceWidget per the user's own
 * ask) with a real 6-month trend sparkline alongside it, fed by
 * dashboard.service.js's computeActiveMobilisationRevenueTrend — the exact same
 * "active at any point in the month" figure this card's own number already
 * shows, repeated per trailing month. Never a synthesized series: a flat or
 * empty trend just means the real numbers were flat or zero.
 */
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const SPARK_WIDTH = 320;
const SPARK_HEIGHT = 64;
const SPARK_PAD_Y = 6;

/** Minimal inline sparkline — no charting library for a 6-point line (see
 *  CLAUDE.md's "never add a library where ~30 lines would do"). Purely a
 *  glance-at trend shape, so no axes/gridlines/tooltips — the exact numbers
 *  live in the big figure and the month labels underneath. */
function Sparkline({ trend }) {
  const values = trend.map((t) => t.revenue);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = SPARK_WIDTH / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = SPARK_HEIGHT - SPARK_PAD_Y - ((v - min) / range) * (SPARK_HEIGHT - SPARK_PAD_Y * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${SPARK_WIDTH},${SPARK_HEIGHT} L0,${SPARK_HEIGHT} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className="h-16 w-full max-w-xs"
      preserveAspectRatio="none"
      role="img"
      aria-label={trend.map((t) => `${t.month}: ${t.revenue}`).join(', ')}
    >
      <path d={areaPath} className="fill-success/10" />
      <path d={linePath} className="fill-none stroke-success" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" className="fill-success" />
    </svg>
  );
}

export default function ActiveRevenueWidget({ revenue, trend }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isCoordinator = user.role === 'Coordinator';

  if (revenue == null) return null;

  // Real month-over-month delta off the same trend data — honest supporting
  // context, not a decorative badge. Hidden when there's nothing meaningful
  // to compare (fewer than 2 real points, or the prior month was 0).
  const hasTrend = Array.isArray(trend) && trend.length >= 2;
  const prev = hasTrend ? trend[trend.length - 2].revenue : null;
  const deltaPct = hasTrend && prev ? Math.round(((revenue - prev) / prev) * 100) : null;

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="block text-4xl font-bold text-success">{formatMoney(revenue)}</span>
          <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">
            {t(isCoordinator ? 'staffDashboard.widgets.activeRevenue.titleMine' : 'staffDashboard.widgets.activeRevenue.titleCompany')}
          </span>
          <p className="mt-1 text-xs text-muted">
            {t('staffDashboard.widgets.activeRevenue.hint')}
            {deltaPct != null && (
              <span className={deltaPct >= 0 ? 'ml-1 font-medium text-success' : 'ml-1 font-medium text-danger'}>
                {deltaPct >= 0 ? '+' : ''}
                {deltaPct}% {t('staffDashboard.widgets.activeRevenue.vsLastMonth')}
              </span>
            )}
          </p>
        </div>

        {hasTrend && (
          // dir="ltr" is deliberate, not a bug: the chart itself (oldest data on the
          // left, newest on the right) never mirrors for RTL — same convention this
          // app already follows for numerals/charts generally. Without it, RTL's own
          // flex-item reversal would flip the two month labels below while the SVG's
          // own coordinates stay put, mislabeling which end is which (found live while
          // verifying this in Arabic).
          <div dir="ltr" className="sm:w-1/2 sm:max-w-xs">
            <Sparkline trend={trend} />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
              <span>{trend[0].month}</span>
              <span>{trend[trend.length - 1].month}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
