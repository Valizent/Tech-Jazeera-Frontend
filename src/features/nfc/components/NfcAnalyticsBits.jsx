/**
 * Shared building blocks for the NFC analytics screens — stat tiles, the daily
 * trend, and breakdown lists. Kept in one file because the card panel, the
 * company panel and the overview page all compose the same four pieces.
 *
 * The trend is plain CSS bars rather than a charting library: it is one metric
 * over a fixed number of days, which is a flexbox and a percentage height. A
 * chart dependency would be several hundred kilobytes to draw rectangles.
 */
import { cn, timeAgo } from '../../../lib/utils.js';

/** Window options offered everywhere analytics appear. */
export const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

const nf = new Intl.NumberFormat('en-US');

/** Friendly labels for the raw keys the API returns. */
export const TARGET_LABELS = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  altEmail: 'Alternate Email',
  website: 'Website',
  linkedin: 'LinkedIn',
  location: 'Location',
};
export const DEVICE_LABELS = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' };

/**
 * Country codes → names, so the panel does not show bare "SA". Built from the
 * browser's own Intl data, which already ships every country name.
 */
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryName(code) {
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code; // not a valid region code show it raw rather than crash
  }
}

/** The trailing-window switcher. */
export function RangePicker({ days, onChange, disabled = false }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          disabled={disabled}
          aria-pressed={days === r.days}
          onClick={() => onChange(r.days)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
            days === r.days ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** One headline number. */
function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{nf.format(value ?? 0)}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * The headline row. "Saved contact" is shown as a rate too, because 40 views
 * with 30 saves and 400 views with 30 saves are very different outcomes.
 */
export function StatTiles({ totals, lastEventAt }) {
  const { views = 0, uniqueVisitors = 0, saves = 0, clicks = 0, images = 0 } = totals ?? {};
  const rate = views > 0 ? Math.round((saves / views) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Taps" value={views} hint={`${nf.format(uniqueVisitors)} unique`} />
      <Stat label="Contacts saved" value={saves} hint={views > 0 ? `${rate}% of taps` : undefined} />
      <Stat label="Link taps" value={clicks} />
      <Stat label="Card downloaded" value={images} />
      <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
        <p className="text-xs uppercase tracking-wide text-muted">Last tapped</p>
        <p className="mt-0.5 truncate text-sm font-medium">{lastEventAt ? timeAgo(lastEventAt) : 'Never'}</p>
      </div>
    </div>
  );
}

/**
 * Daily trend. Each bar's height is that day's taps; the solid lower part is
 * the share that saved the contact, so "did anyone act on it" is visible at a
 * glance rather than being a second chart.
 */
export function TrendBars({ series = [] }) {
  const max = Math.max(1, ...series.map((d) => d.views));
  const dense = series.length > 60; // a year of bars needs no gaps

  if (series.every((d) => d.views === 0 && d.saves === 0 && d.clicks === 0)) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-bg px-3 py-8 text-center text-sm text-muted">
        No taps in this period yet.
      </p>
    );
  }

  return (
    <div>
      <div className={cn('flex h-28 items-end', dense ? 'gap-px' : 'gap-1')} role="img" aria-label="Daily taps">
        {series.map((d) => {
          const saved = Math.min(d.saves, d.views); // guard a save without a counted view
          return (
            <div
              key={d.date}
              className="group relative flex-1 rounded-t bg-primary/20 transition-colors hover:bg-primary/40"
              style={{ height: `${Math.max((d.views / max) * 100, d.views > 0 ? 6 : 2)}%` }}
              title={`${d.date} ${d.views} tap${d.views === 1 ? '' : 's'}, ${d.saves} saved, ${d.clicks} link tap${d.clicks === 1 ? '' : 's'}`}
            >
              {saved > 0 && (
                <span
                  className="absolute inset-x-0 bottom-0 rounded-t bg-primary"
                  style={{ height: `${(saved / d.views) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{series[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/20" /> Taps
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary" /> Saved
          </span>
        </span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/** A ranked list with proportional bars — used for links, countries, devices. */
export function Breakdown({ title, rows = [], labels, format = (k) => k, empty = 'No data yet.' }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="relative overflow-hidden rounded-lg bg-bg px-2.5 py-1.5">
              <span
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{labels?.[r.key] ?? format(r.key)}</span>
                <span className="shrink-0 tabular-nums text-muted">{nf.format(r.count)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
