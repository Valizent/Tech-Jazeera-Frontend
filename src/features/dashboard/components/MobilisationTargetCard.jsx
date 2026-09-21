/**
 * MobilisationTargetCard — the coordinator's own monthly target tracker.
 *
 * Shows an animated SVG progress ring, the count achieved vs. target, and
 * how many remain. When the coordinator hits or exceeds their target:
 *   - The ring fills gold and pulses.
 *   - A confetti burst fires (CSS-only, ~30 coloured particles, once per
 *     page session).
 *   - The card border shimmers with a gold gradient.
 *   - The incentive % is shown as a motivational sub-line.
 *
 * Renders nothing when `target` is null (no target set for this month).
 */
import { useEffect, useRef, useState } from 'react';

const RING_R = 54;          // SVG circle radius
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

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

  // Format month label e.g. "2026-09" → "September 2026"
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
          0%, 100% { filter: drop-shadow(0 0 4px rgba(251,191,36,0.5)); }
          50%       { filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)); }
        }
      `}</style>

      <div
        className="relative overflow-hidden rounded-2xl border bg-surface p-5 transition-all"
        style={
          hit
            ? {
                borderColor: 'transparent',
                backgroundImage:
                  'linear-gradient(var(--color-surface), var(--color-surface)), linear-gradient(135deg,#f59e0b,#fcd34d,#f59e0b,#b45309)',
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
                stroke={hit ? '#f59e0b' : 'var(--color-primary)'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s' }}
              />
              {/* Centre text */}
              <text
                x="60"
                y="55"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
                fontWeight="700"
                fill={hit ? '#f59e0b' : 'var(--color-text)'}
              >
                {achieved}
              </text>
              <text
                x="60"
                y="73"
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-muted)"
              >
                / {targetCount}
              </text>
            </svg>
          </div>

          {/* Text side */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{monthLabel}</p>
              {hit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Target Achieved!
                </span>
              )}
            </div>

            <h2 className="mt-1 text-lg font-bold text-text">
              {hit ? 'You hit your target!' : `${remaining} mobilisation${remaining !== 1 ? 's' : ''} to go`}
            </h2>

            {hit ? (
              <p className="mt-1 text-sm text-muted">
                Every extra mobilisation this month{' '}
                {incentivePercent > 0 ? (
                  <>
                    earns you{' '}
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {incentivePercent}% of its profit
                    </span>{' '}
                    as an incentive.
                  </>
                ) : (
                  'counts toward your streak.'
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {achieved === 0
                  ? `Hit ${targetCount} approved mobilisations to unlock your incentive.`
                  : `${achieved} of ${targetCount} done — keep going!`}
                {incentivePercent > 0 && (
                  <> Once you do, you earn{' '}
                    <span className="font-semibold text-primary">{incentivePercent}% of profit</span>{' '}
                    per extra mobilisation.
                  </>
                )}
              </p>
            )}

            {/* Progress bar (secondary visual below the ring copy) */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: hit ? '#f59e0b' : 'var(--color-primary)',
                }}
              />
            </div>
            <p className="mt-1 text-right text-xs tabular-nums text-muted">
              {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
