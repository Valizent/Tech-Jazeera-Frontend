/**
 * Tiny shared utilities. Anything here must be used by 2+ features —
 * single-use helpers belong next to their caller.
 */

/** Join class names, skipping falsy values: cn('a', cond && 'b') → 'a b'. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Extract the server's human-readable message from a failed Axios call.
 * Our API always returns { success:false, message, details? } — validation
 * failures (validate.js) carry a generic top-level message ("Validation
 * failed.") plus per-field reasons in `details`. Prefer those: "Validation
 * failed." tells the user nothing about what to fix, while the field
 * messages (e.g. "Tier years and tier days must be set together.") do.
 * Falls back to the top-level message, then a generic string for
 * network-level failures where no response exists at all.
 */
export function apiMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (Array.isArray(data.details) && data.details.length > 0) {
    return [...new Set(data.details.map((d) => d.message))].join(' ');
  }
  return data.message ?? fallback;
}

/** Display format: "23 Jul 2026". Em-dash for missing values. */
export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Display format with time: "23 Jul 2026, 14:05". For logs where the exact
 *  moment matters, not just the day. Em-dash for missing values. */
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Display format: time only, "14:05". Em-dash for missing values. */
export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Worked hours to 1 decimal for display: 8.4667 → "8.5". Em-dash for missing values. */
export function formatHours(value) {
  if (value == null) return '—';
  return Number(value).toFixed(1);
}

/** ISO date → the "YYYY-MM-DD" format <input type="date"> requires. */
export function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

/** Whole days from now until a date; negative = already past. */
export function daysUntil(value) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

/** Format a number as SAR currency: 1234.5 → "SAR 1,234.50". */
export function formatMoney(value) {
  return `SAR ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Amount one line item (quotation/invoice) contributes to the grand total
 *  (net + its tax) — display-only; the authoritative stored total is always
 *  server-computed (see server/src/utils/moneyMath.js's own lineAmount,
 *  the same formula, kept separately since client/server can't share a
 *  file across repos). */
export function lineAmount(li) {
  const gross = li.quantity * li.unitPrice;
  const net = gross - gross * ((li.discount ?? 0) / 100);
  return net + net * ((li.taxRate ?? 0) / 100);
}

/** Bytes → "1.2 MB" / "340 KB". */
export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Green when profit, red when loss — zero stays neutral (not a loss). */
export function profitClass(amount) {
  if (amount > 0) return 'text-success';
  if (amount < 0) return 'text-danger';
  return undefined;
}

/** Column-header sort toggle: clicking the same key again flips asc/desc,
 *  a new key starts ascending, and either way resets to page 1. Pass the
 *  list page's own `setParams` (any shape with sortBy/sortOrder/page) and
 *  call the result from a column header's onClick. */
export function createSortToggle(setParams) {
  return (key) =>
    setParams((p) => ({
      ...p,
      sortBy: key,
      sortOrder: p.sortBy === key && p.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
}

/** Compact relative time: "just now", "5m ago", "3h ago", "2d ago", else a date. */
export function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}
