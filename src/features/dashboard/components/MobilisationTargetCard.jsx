/**
 * MobilisationTargetCard — the coordinator's own monthly target tracker.
 *
 * Shows an animated SVG progress ring, the estimated profit achieved vs.
 * target (Riyal amounts — 2026-09-22, real user correction: this used to
 * track a plain mobilisation COUNT; a coordinator's real value to the
 * company is the profit their placements bring in), and how much remains.
 * Below 100% the ring/bar/percentage shift red → orange → yellow → green
 * continuously with progress (progressColor, below). When the coordinator
 * hits or exceeds their target (2026-09-24: green, not the earlier gold —
 * a real user correction, so 100%+ is the natural endpoint of the same
 * scale rather than a different color entirely):
 *   - The ring fills green and pulses.
 *   - A confetti burst fires (CSS-only, ~30 coloured particles, once per
 *     page session).
 *   - The card border shimmers with a green gradient.
 *   - The incentive % is shown as a motivational sub-line.
 *
 * Renders nothing when `target` is null (no target set for this month).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../../../lib/utils.js';

// A full "⃁ 45,231.50" doesn't fit legibly inside the 120px ring, so the
// ring itself shows a compact form ("⃁45K") — the full formatMoney()
// amount is what the text beside/below the ring always shows.
const compactMoney = (n) => `⃁${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

const RING_R = 54;          // SVG circle radius
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

// Continuous red → orange → yellow → green as progress goes 0 → 1 (hue 0 → 120
// on the color wheel) — 2026-09-24, a real user report: at low progress the
// ring/bar used the same neutral primary color regardless of how far behind
// the coordinator was, so a genuinely bad 5% looked no different from 50%.
// `hit` (>=100%) reuses this exact scale's own green endpoint (progressColor(1))
// rather than a separate color, so hitting the target reads as this scale
// simply completing, not switching to something else.
const progressColor = (progress) => `hsl(${Math.round(progress * 120)}, 85%, 45%)`;
const HIT_COLOR = progressColor(1);

const CONFETTI_COLORS = [
  '#f59e0b', '#10b981', '#6366f1', '#ec4899',
  '#f97316', '#06b6d4', '#84cc16', '#a855f7',
];

function ConfettiBurst() {
  // 30 particles, random angle/distance/size/color, pure CSS animation.
  const particles = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * 360 + Math.random() * 12;
    const dist = 60 + Math.random() * 80;
    const size = 5 + Math.random() * 6;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const delay = Math.random() * 0.3;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    return { tx, ty, size, color, delay };
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl">
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
            backgroundColor: p.color,
            animation: `confetti-fly 0.8s ${p.delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function MobilisationTargetCard({ target }) {
  const { t } = useTranslation();
  const celebratedRef = useRef(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const hit = target?.hit ?? false;

  // Fire confetti once per page session when the target is first seen as hit.
  useEffect(() => {
    if (hit && !celebratedRef.current) {
      celebratedRef.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
    }
  }, [hit]);

  if (!target) return null;

  const { achieved, remaining, target: targetCount, incentivePercent, month } = target;
  const progress = Math.min(achieved / targetCount, 1);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const color = hit ? HIT_COLOR : progressColor(progress);

  // Format month label e.g. "2026-09" → "September 2026" — left in English deliberately,
  // same documented scope boundary every other date/number format in this app already
  // follows (server-generated text and date/number formatting stay English/unlocalized).
  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      {/* Inject confetti keyframe once into the document */}
      <style>{`
        @keyframes confetti-fly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes shimmer-border {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ring-pulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(34,197,94,0.5)); }
          50%       { filter: drop-shadow(0 0 12px rgba(34,197,94,0.9)); }
        }
      `}</style>

      <div
        className="relative overflow-hidden rounded-2xl border bg-surface p-5 transition-all"
        style={
          hit
            ? {
                borderColor: 'transparent',
                backgroundImage:
                  'linear-gradient(var(--color-surface), var(--color-surface)), linear-gradient(135deg,#16a34a,#4ade80,#16a34a,#166534)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                backgroundSize: '200% 200%, 200% 200%',
                animation: 'shimmer-border 3s ease infinite',
              }
            : {}
        }
      >
        {showConfetti && <ConfettiBurst />}

        <div className="flex items-center gap-5">
          {/* SVG Progress Ring */}
          <div className="relative shrink-0">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              style={hit ? { animation: 'ring-pulse 2s ease-in-out infinite' } : {}}
            >
              {/* Track */}
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="10"
              />
              {/* Progress arc */}
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s' }}
              />
              {/* Centre text — compact form (see compactMoney's own doc
                  comment above); the full amounts are in the text below. */}
              <text
                x="60"
                y="55"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="18"
                fontWeight="700"
                fill={hit ? color : 'var(--color-text)'}
              >
                {compactMoney(achieved)}
              </text>
              <text
                x="60"
                y="73"
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-muted)"
              >
                / {compactMoney(targetCount)}
              </text>
            </svg>
          </div>

          {/* Text side */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{monthLabel}</p>
              {hit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  {t('staffDashboard.targets.card.achievedBadge')}
                </span>
              )}
            </div>

            <h2 className="mt-1 text-lg font-bold text-text">
              {hit ? t('staffDashboard.targets.card.titleHit') : t('staffDashboard.targets.card.titleRemaining', { amount: formatMoney(remaining) })}
            </h2>

            {hit ? (
              <p className="mt-1 text-sm text-muted">
                {incentivePercent > 0
                  ? t('staffDashboard.targets.card.hitWithIncentive', { percent: incentivePercent })
                  : t('staffDashboard.targets.card.hitNoIncentive')}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {achieved === 0
                  ? t('staffDashboard.targets.card.notHitZero', { target: formatMoney(targetCount) })
                  : t('staffDashboard.targets.card.notHitSome', { achieved: formatMoney(achieved), target: formatMoney(targetCount) })}
                {incentivePercent > 0 && <> {t('staffDashboard.targets.card.notHitIncentiveSuffix', { percent: incentivePercent })}</>}
              </p>
            )}

            {/* Progress bar (secondary visual below the ring copy) */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-semibold tabular-nums transition-colors duration-700" style={{ color }}>
              {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
