/**
 * ActiveRevenueWidget — the big "active mobilisation revenue" figure, full
 * width (2026-09-24, swapped places with HrComplianceWidget per the user's own
 * ask) with a real 6-month trend sparkline alongside it, fed by
 * dashboard.service.js's computeActiveMobilisationRevenueTrend — the exact same
 * "active at any point in the month" figure this card's own number already
 * shows, repeated per trailing month. Never a synthesized series: a flat or
 * empty trend just means the real numbers were flat or zero.
 *
 * Clickable through to the Deployments register's own spreadsheet-style
 * Overview modal (2026-09-24, the user's own ask, confirmed before building —
 * this figure IS mobilisation-active-deployment revenue, so "show me the
 * deployments behind this number" is the one genuinely relevant destination),
 * via a `?overview=1` deep link (see DeploymentListPage's own doc comment) —
 * gated on real `deploymentsRelease` read so this never links somewhere that
 * would just 403. The sparkline itself is hover-interactive: a tooltip shows
 * the exact month + amount for whichever point the pointer is nearest.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const SPARK_WIDTH = 320;
const SPARK_HEIGHT = 64;
const SPARK_PAD_Y = 6;

/** Minimal inline sparkline — no charting library for a 6-point line (see
 *  CLAUDE.md's "never add a library where ~30 lines would do"). Hover (or
 *  touch) shows a real tooltip for the nearest month; no library needed for
 *  that either — the SVG's own bounding rect plus the same points already
 *  computed for the line is all it takes. */
function Sparkline({ trend }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

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

  function nearestIndexFromClientX(clientX) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const fracX = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(values.length - 1, Math.round(fracX * (values.length - 1))));
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  // Tooltip position as a % of the viewBox — CSS-positioned against the
  // wrapper, not the SVG's own internal coordinate space, so it stays a
  // crisp, correctly-sized HTML box regardless of how much the SVG itself
  // is scaled up/down by its container.
  const tooltipStyle = hovered
    ? { left: `${(hovered[0] / SPARK_WIDTH) * 100}%`, top: `${(hovered[1] / SPARK_HEIGHT) * 100}%` }
    : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        className="h-16 w-full max-w-xs cursor-pointer"
        preserveAspectRatio="none"
        role="img"
        aria-label={trend.map((t) => `${t.month}: ${t.revenue}`).join(', ')}
        onMouseMove={(e) => setHoverIndex(nearestIndexFromClientX(e.clientX))}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={(e) => setHoverIndex(nearestIndexFromClientX(e.touches[0].clientX))}
        onTouchMove={(e) => setHoverIndex(nearestIndexFromClientX(e.touches[0].clientX))}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <path d={areaPath} className="fill-success/10" />
        {hovered && (
          <line x1={hovered[0]} y1="0" x2={hovered[0]} y2={SPARK_HEIGHT} className="stroke-success/25" strokeWidth="1" />
        )}
        <path d={linePath} className="fill-none stroke-success" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="3.5" className="fill-success" />
        {hovered && (
          <circle cx={hovered[0]} cy={hovered[1]} r="4.5" className="fill-success stroke-surface" strokeWidth="2" />
        )}
      </svg>

      {hovered && tooltipStyle && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={tooltipStyle}
        >
          <div className="font-semibold text-text">{formatMoney(trend[hoverIndex].revenue)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">{trend[hoverIndex].month}</div>
        </div>
      )}
    </div>
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

  // Gated on real deploymentsRelease read — the same key DeploymentListPage's
  // own route requires — so this never links somewhere that would just 403.
  const canOpenDeployments = Boolean(user.sectionAccess?.includes('deploymentsRelease'));

  const body = (
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
        {/* `end-4`, not `right-4` (2026-09-24, found live while checking this in
            Arabic): this app's RTL relies on native flow (flexbox/text reversal),
            which does NOT extend to an absolutely-positioned element's physical
            left/right offset — `right-4` would sit in the same physical corner
            in both languages, landing on top of the card's own (RTL-mirrored)
            number/label instead of its empty corner. `end-4` is a logical
            property (`inset-inline-end`), so it follows `dir` automatically. */}
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
