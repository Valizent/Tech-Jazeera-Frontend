/**
 * DeploymentOverviewModal — "see the entire register like a spreadsheet"
 * (2026-09-16, the user's own ask): every deployment, every column the
 * Excel export itself has, each with its own Excel-style column filter —
 * a free-text filter for a free-typed column, a picklist of the values
 * actually present for an enum one (worker type/status/end reason). All
 * filtering happens CLIENT-SIDE against one bulk fetch (`listDeployments`
 * with a raised `limit`, unfiltered by the register's own status/client
 * pickers — this is a deliberate "see everything" escape hatch, same
 * framing as the Standby List's own separate, unfiltered view) — there's
 * no real pagination need at this company's actual data volume, and
 * filtering a few hundred already-loaded rows in memory is instant, unlike
 * round-tripping a request per keystroke.
 *
 * Same-day follow-up: the user asked whether every ENTERED value shows up
 * here — it didn't. `monthlyHours` (the real, ongoing client-timesheet-
 * hours/OT ledger, the biggest piece of data this whole module accumulates
 * over time) is a one-to-MANY field (one deployment, many months), so it
 * can never be a flat column the way Site/Status are. Their own explicit
 * choice, from a direct question: an expandable row — a toggle reveals
 * that deployment's full month-by-month breakdown inline, without leaving
 * the spreadsheet view. `otAmount` is commercial (see deployment.model.js's
 * own doc comment) and is already stripped server-side for anyone without
 * `deploymentsHoursDecide` — that column only renders here at all if the
 * loaded data actually has it on at least one entry, never a static
 * assumption re-checked client-side.
 *
 * 2026-09-17 follow-up (the user's own ask — a screenshot of this exact
 * modal, "need every single data entered in mobilisation", plus "fill more
 * screen" and "use a scroll wheel to right and left... like excel"): three
 * changes. (1) `size="screen"` (new, see Modal.jsx) instead of 'full' — a
 * near-edge-to-edge, taller dialog. (2) Horizontal scroll was already native
 * (`overflow-auto` on the table's own wrapper) — a wide table with this many
 * columns now genuinely needs it, same as any real Excel sheet; no custom
 * wheel-hijacking added, the browser's own shift+wheel/trackpad/scrollbar
 * already behaves exactly like Excel's own horizontal scroll. (3) Every
 * Mobilisation field this app already treats as export-worthy (see
 * mobilisation.export.js's own WORKER_COLUMNS+RATE_COLUMNS) is appended,
 * read off the now-fully-populated `d.mobilisation` sub-document (see
 * deployment.service.js's MOBILISATION_OVERVIEW_FIELDS) — MINUS whatever's a
 * pure duplicate of a Deployment snapshot field already shown. The 9
 * commercial columns (rates/commissions/profit) are gated exactly like
 * `otAmount` above: server-stripped for anyone without
 * `deploymentsHoursDecide` read access, and the columns themselves only
 * render at all if the loaded data actually has them on at least one row —
 * the user's own explicit choice from a direct question, put to them before
 * building this (include, but gated the same way otAmount already is).
 *
 * Second same-day follow-up (2026-09-17, from a screenshot of this exact
 * modal): (1) the dialog now fills the viewport (see Modal.jsx's `screen`
 * size, reworked to a fixed height + top alignment instead of a shrink-to-
 * fit max-height) rather than sitting centered with dead space above/below a
 * short table. (2) A Month filter (toolbar, not a per-column filter — it
 * doesn't correspond to one flat field) narrows rows to deployments with a
 * `monthlyHours` entry for that month, same client-side filtering as every
 * other column. (3) `otProfitPerHour`/`profitPerMonth` swapped display
 * order (the user's own ask). (4) A new `mobTotalProfitPerMonth` column —
 * `profitPerMonth` (the pre-deployment ESTIMATE, no OT) plus that specific
 * month's real OT contribution (`otProfitPerHour × otHours` off the
 * matching monthlyHours entry, always present once a row passes the month
 * filter) — only rendered once a month is actually selected (blank/estimate
 * -only otherwise would be misleading; hidden entirely in the normal,
 * no-month-selected view, same "don't show a number these terms don't
 * apply to" posture as `hasCommercialMobilisation` itself). (5) A sticky
 * totals row (mirrors the header's own `sticky top-0`) sums every numeric
 * commercial column (rates/commissions/profit figures) across whatever
 * rows are currently visible — so filtering to one month makes that row
 * read as "this month's total profit" across the matching placements,
 * which was the actual point of the whole feature. (6) Profit-labeled
 * cells (`profitPerHour`/`otProfitPerHour`/`profitPerMonth`/the new total)
 * color green/red by sign — reusing the exact `profitClass` convention
 * MobilisationDetailPage.jsx already established for these same fields,
 * not a new color scheme.
 *
 * Third same-day follow-up (2026-09-17, from another screenshot): the
 * expandable-row/dropdown from the "Same-day follow-up" note above is GONE
 * — the user's own explicit ask ("instead of this dropdown"), superseded by
 * the Month filter mechanism above: once a month is picked, the figures
 * that used to require expanding a row now show as flat columns instead —
 * `mobMonthTotalHours` (that month's real `actualHours`, not commercial,
 * shown regardless of `hasCommercialMobilisation`), `mobMonthOtAmount`
 * (that month's `otAmount`, gated by `hasOtAmount` same as before), and
 * `mobMonthTotalAmount` (`entry.contractHours × clientRate + otAmount` —
 * "regular + OT combined," the user's own explicit choice between two
 * options put to them directly). The sticky totals row was also reworked:
 * it used to assume every summable column sat contiguously at the END of
 * `columns` (true before this follow-up); now it maps the FULL `columns`
 * array and sums whichever ones have a `getNumber`, blank otherwise — this
 * is what fixes the user's own catch ("we missed FTA and Allowance") by
 * simply giving those two existing columns a `getNumber` too, no longer
 * requiring them to sit next to the other summed columns.
 *
 * Sixth same-day follow-up (2026-09-17, the user's own ask — "can I
 * rearrange each column... like drag and drop needed column space"):
 * drag-and-drop column reordering, native HTML5 drag events on each
 * header cell (row 1 only — row 2's filter inputs/selects stay
 * non-draggable so clicking them still works normally). `columnOrder` is
 * a plain array of column KEYS, not a second copy of the column
 * definitions — `orderedColumns` (below) re-sorts the real `columns`
 * array against it every render, so a column that appears/disappears
 * (the whole commercial group, the month-specific ones) never desyncs:
 * a stored key with no matching column is silently dropped, and any
 * column not yet in the stored order (new, or the very first render)
 * appends at the end.
 *
 * Seventh same-day follow-up (2026-09-17, the user's own ask — "have an
 * option to set it as a default layout... along with reset column[s],
 * give these two options under one button"): a drag no longer
 * auto-persists to localStorage — it only updates `columnOrder` for the
 * rest of THIS session, so trying an arrangement never silently
 * overwrites a saved one. A single "Columns" button opens a small menu
 * (same outside-click-closes pattern as SearchableSelect.jsx) with two
 * explicit actions: "Set as default" writes the CURRENT order to
 * localStorage (a personal display preference, not worth a server round
 * trip — same convention DashboardPage.jsx's own expiry-threshold setting
 * already uses) so it's what loads next time the modal opens; "Reset
 * columns" clears both the session order and the saved default back to
 * the built-in order. Both are disabled when there's nothing to act on
 * (`columnOrder === null` — the built-in order, never touched this
 * session and nothing saved from before).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDeployments } from '../deployments.api.js';
import { formatDate, formatMoney, cn, profitClass } from '../../../lib/utils.js';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const OVERVIEW_ROW_LIMIT = 5000;
const COLUMN_ORDER_STORAGE_KEY = 'deploymentsOverviewColumnOrder';

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

// Full month names, '01'..'12' — a fixed list, unlike yearOptions below,
// since every year has the same twelve months regardless of what data
// exists. English only, matching lib/utils.js's own formatDate (this app's
// documented scope boundary: dates stay English/unlocalized everywhere).
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: new Date(Date.UTC(2000, i, 1)).toLocaleDateString('en-GB', { month: 'long' }),
}));

// 'YYYY-MM' → 'March 2026' — the Month filter's own value formatted for a
// human, reused by the empty-state message below.
function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function DeploymentOverviewModal({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
  // Year + Month are two independent selects (2026-09-17, the user's own
  // ask) rather than one dropdown of only-the-months-that-have-data — this
  // is what lets someone deliberately pick a month with NO data at all
  // (e.g. "March 2026") and get a real, readable "no deployments that
  // month" answer instead of that month simply never being selectable.
  // `monthFilter` (the 'YYYY-MM' string every other piece of this file
  // already reads) is DERIVED, not its own state — filtering only takes
  // effect once both are chosen.
  const [filterYear, setFilterYear] = useState('');
  const [filterMonthNum, setFilterMonthNum] = useState('');
  const monthFilter = filterYear && filterMonthNum ? `${filterYear}-${filterMonthNum}` : '';

  // Drag-and-drop column order (see this file's own module comment) — an
  // array of column keys, or null for the built-in order. Dragging only
  // updates this SESSION state; it's a genuinely separate, explicit action
  // ("Set as default" below) that writes it to localStorage, so trying an
  // arrangement can never silently clobber a saved one. Lazily read once
  // here so a previously-saved default still applies the moment the modal
  // opens.
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const raw = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [draggedKey, setDraggedKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef(null);

  useEffect(() => {
    if (!columnsMenuOpen) return undefined;
    function handleClickOutside(e) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)) {
        setColumnsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnsMenuOpen]);

  function setColumnOrderAsDefault() {
    if (!columnOrder) return;
    try {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
    } catch {
      // Private window / storage blocked — non-fatal, just won't survive a reload.
    }
    setColumnsMenuOpen(false);
  }

  function resetColumnOrder() {
    setColumnOrder(null);
    try {
      localStorage.removeItem(COLUMN_ORDER_STORAGE_KEY);
    } catch {
      // same as above — non-fatal either way.
    }
    setColumnsMenuOpen(false);
  }

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', 'overview'],
    queryFn: () => listDeployments({ page: 1, limit: OVERVIEW_ROW_LIMIT, sortOrder: 'desc' }),
    enabled: open,
    staleTime: 30_000,
  });
  // A stable reference when empty (not a fresh `[]` every render) — both
  // useMemo hooks below depend on `rows`, and a new array identity on every
  // render would otherwise recompute them needlessly on every keystroke
  // elsewhere on the page.
  const rows = useMemo(() => data?.items ?? [], [data]);

  // Commercial Mobilisation fields (rates/commissions/profit) are stripped
  // server-side for anyone without 'deploymentsHoursDecide' read access —
  // same signal/reasoning as hasOtAmount below, applied to the whole
  // commercial column group at once rather than per-field.
  const hasCommercialMobilisation = useMemo(
    () => rows.some((d) => d.mobilisation?.clientRate !== undefined),
    [rows]
  );

  // otAmount is commercial (see this file's own header comment) — the
  // server already strips it entirely for anyone without
  // 'deploymentsHoursDecide' access, so its presence on even one loaded
  // entry is a reliable, no-extra-request signal that the whole response
  // has it. Never re-derived from the viewer's own role client-side. Gates
  // the month-specific OT-amount column below.
  const hasOtAmount = useMemo(() => rows.some((d) => d.monthlyHours.some((m) => m.otAmount !== undefined)), [rows]);

  // The Year select's own options — a CONTIGUOUS range (not just years that
  // have data, unlike the removed monthOptions this replaces), so a genuinely
  // empty year in the middle of the range still selects cleanly. Spans every
  // year touched by any deployment's own dates or monthlyHours entries, plus
  // the current year — always at least one real, useful year even for a
  // brand-new company with zero deployments yet.
  const yearOptions = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    for (const d of rows) {
      years.add(new Date(d.startDate).getFullYear());
      if (d.endDate) years.add(new Date(d.endDate).getFullYear());
      for (const m of d.monthlyHours) years.add(Number(m.month.slice(0, 4)));
    }
    const min = Math.min(...years);
    const max = Math.max(...years);
    const result = [];
    for (let y = min; y <= max; y++) result.push(y);
    return result;
  }, [rows]);

  // Columns match deployment.export.js's own list exactly, so the modal and
  // the downloaded .xlsx always read the same way. `getText` is what both
  // the free-text filter and the cell itself use — one source, so a column
  // never filters on text different from what's actually on screen. The
  // Mobilisation-sourced columns (from staffDeployments.overview.columns.
  // 4th group onward) reuse this app's OWN Mobilisation field labels
  // (staffMobilisations.detail.fields.*) rather than new duplicate keys —
  // the same field, same label, everywhere it appears.
  const columns = useMemo(() => {
    const cols = [
      { key: 'workerName', header: t('staffDeployments.overview.columns.worker'), getText: (d) => d.workerName ?? '' },
      {
        key: 'workerType',
        header: t('staffDeployments.overview.columns.workerType'),
        type: 'enum',
        getText: (d) => t(`staffMobilisations.form.workerType.${d.workerType}`, d.workerType),
        getValue: (d) => d.workerType,
      },
      { key: 'clientName', header: t('staffDeployments.overview.columns.client'), getText: (d) => d.clientName ?? '' },
      { key: 'site', header: t('staffDeployments.overview.columns.site'), getText: (d) => d.site ?? '' },
      {
        key: 'subcontractorName',
        header: t('staffDeployments.overview.columns.subcontractor'),
        getText: (d) => d.subcontractorName ?? '',
      },
      {
        key: 'requiredTimesheetHours',
        header: t('staffDeployments.overview.columns.contractHours'),
        getText: (d) => (d.requiredTimesheetHours != null ? String(d.requiredTimesheetHours) : ''),
      },
      { key: 'startDate', header: t('staffDeployments.overview.columns.startDate'), getText: (d) => (d.startDate ? formatDate(d.startDate) : '') },
      { key: 'endDate', header: t('staffDeployments.overview.columns.endDate'), getText: (d) => (d.endDate ? formatDate(d.endDate) : '') },
      {
        key: 'status',
        header: t('staffDeployments.overview.columns.status'),
        type: 'enum',
        getText: (d) => t(`staffDeployments.status.${d.status}`, d.status),
        getValue: (d) => d.status,
      },
      {
        key: 'endReason',
        header: t('staffDeployments.overview.columns.endReason'),
        type: 'enum',
        getText: (d) => (d.endReason ? t(`staffDeployments.reasons.${d.endReason}`, d.endReason) : ''),
        getValue: (d) => d.endReason,
      },
      { key: 'notes', header: t('staffDeployments.overview.columns.notes'), getText: (d) => d.notes ?? '' },
      // --- Mobilisation-sourced (2026-09-17 follow-up, see this file's own
      // module comment) — non-commercial fields, always shown ---
      {
        key: 'mobSerialNumber',
        header: t('staffDeployments.overview.columns.mobilisationNumber'),
        getText: (d) => d.mobilisation?.serialNumber ?? '',
      },
      {
        key: 'mobJobTitle',
        header: t('staffMobilisations.detail.fields.jobTitle'),
        getText: (d) => d.mobilisation?.jobTitle ?? '',
      },
      {
        key: 'mobIqamaNumber',
        header: t('staffMobilisations.detail.fields.iqamaNumber'),
        getText: (d) => d.mobilisation?.iqamaNumber ?? '',
      },
      {
        key: 'mobNationality',
        header: t('staffMobilisations.detail.fields.nationality'),
        getText: (d) => d.mobilisation?.nationality ?? '',
      },
      { key: 'mobPhone', header: t('staffMobilisations.detail.fields.phone'), getText: (d) => d.mobilisation?.phone ?? '' },
      {
        key: 'mobCheckoutDate',
        header: t('staffMobilisations.detail.fields.checkoutDate'),
        getText: (d) => (d.mobilisation?.checkoutDate ? formatDate(d.mobilisation.checkoutDate) : ''),
      },
      {
        key: 'mobFta',
        header: t('staffMobilisations.detail.fields.fta'),
        getText: (d) => (d.mobilisation?.fta ? formatMoney(d.mobilisation.fta) : ''),
        getNumber: (d) => Number(d.mobilisation?.fta) || 0,
      },
      {
        key: 'mobFtaType',
        header: t('staffMobilisations.detail.fields.ftaType'),
        type: 'enum',
        getText: (d) => (d.mobilisation?.ftaType ? t(`staffMobilisations.form.ftaType.${d.mobilisation.ftaType}`, d.mobilisation.ftaType) : ''),
        getValue: (d) => d.mobilisation?.ftaType,
      },
      {
        key: 'mobAllowance',
        header: t('staffMobilisations.detail.fields.allowance'),
        getText: (d) => (d.mobilisation?.allowance ? formatMoney(d.mobilisation.allowance) : ''),
        getNumber: (d) => Number(d.mobilisation?.allowance) || 0,
      },
      {
        key: 'mobAllowanceRemark',
        header: t('staffMobilisations.detail.fields.allowanceRemark'),
        getText: (d) => d.mobilisation?.allowanceRemark ?? '',
      },
    ];
    // --- Month-specific, non-commercial (the user's own ask: real hours
    // worked that month, off the matching monthlyHours entry — always
    // present once a row has passed the Month filter, so no fallback
    // needed). Visible regardless of hasCommercialMobilisation, same as
    // actualHours was always visible in the removed expand-row table. ---
    if (monthFilter) {
      cols.push({
        key: 'mobMonthTotalHours',
        header: t('staffDeployments.overview.columns.hoursThisMonth'),
        getText: (d) => {
          const entry = d.monthlyHours.find((m) => m.month === monthFilter);
          return entry ? String(entry.actualHours) : '';
        },
        getNumber: (d) => {
          const entry = d.monthlyHours.find((m) => m.month === monthFilter);
          return entry?.actualHours ?? 0;
        },
      });
    }
    // --- Mobilisation-sourced — commercial fields, gated (see
    // hasCommercialMobilisation above). `getNumber` (in addition to
    // getText) powers both the sticky totals row below and, for a
    // `profit: true` column, the green/loss-red cell color — every
    // commercial column gets summed, only the profit-labeled ones get
    // colored. otProfitPerHour/profitPerMonth are swapped from their
    // original order (the user's own ask, 2026-09-17).
    if (hasCommercialMobilisation) {
      cols.push(
        {
          key: 'mobClientRate',
          header: t('staffMobilisations.detail.fields.clientRate'),
          getText: (d) => (d.mobilisation?.clientRate ? formatMoney(d.mobilisation.clientRate) : ''),
          getNumber: (d) => Number(d.mobilisation?.clientRate) || 0,
        },
        {
          key: 'mobClientCommission',
          header: t('staffMobilisations.detail.fields.clientCommission'),
          getText: (d) => (d.mobilisation?.clientCommission ? formatMoney(d.mobilisation.clientCommission) : ''),
          getNumber: (d) => Number(d.mobilisation?.clientCommission) || 0,
        },
        {
          key: 'mobSubcontractorRate',
          header: t('staffMobilisations.detail.fields.subcontractorRate'),
          getText: (d) => (d.mobilisation?.subcontractorRate ? formatMoney(d.mobilisation.subcontractorRate) : ''),
          getNumber: (d) => Number(d.mobilisation?.subcontractorRate) || 0,
        },
        {
          key: 'mobSubcontractorCommission',
          header: t('staffMobilisations.detail.fields.subcontractorCommission'),
          getText: (d) => (d.mobilisation?.subcontractorCommission ? formatMoney(d.mobilisation.subcontractorCommission) : ''),
          getNumber: (d) => Number(d.mobilisation?.subcontractorCommission) || 0,
        },
        {
          key: 'mobOtClientRate',
          header: t('staffMobilisations.detail.fields.otClientRate'),
          getText: (d) => (d.mobilisation?.otClientRate ? formatMoney(d.mobilisation.otClientRate) : ''),
          getNumber: (d) => Number(d.mobilisation?.otClientRate) || 0,
        },
        {
          key: 'mobOtEmployeeRate',
          header: t('staffMobilisations.detail.fields.otEmployeeRate'),
          getText: (d) => (d.mobilisation?.otEmployeeRate ? formatMoney(d.mobilisation.otEmployeeRate) : ''),
          getNumber: (d) => Number(d.mobilisation?.otEmployeeRate) || 0,
        },
        {
          key: 'mobProfitPerHour',
          header: t('staffMobilisations.detail.fields.profitPerHour'),
          profit: true,
          getText: (d) => (d.mobilisation?.profitPerHour != null ? formatMoney(d.mobilisation.profitPerHour) : ''),
          getNumber: (d) => Number(d.mobilisation?.profitPerHour) || 0,
        },
        {
          key: 'mobOtProfitPerHour',
          header: t('staffMobilisations.detail.fields.otProfitPerHour'),
          profit: true,
          getText: (d) => (d.mobilisation?.otProfitPerHour != null ? formatMoney(d.mobilisation.otProfitPerHour) : ''),
          getNumber: (d) => Number(d.mobilisation?.otProfitPerHour) || 0,
        },
        {
          key: 'mobProfitPerMonth',
          header: t('staffMobilisations.detail.fields.profitPerMonth'),
          profit: true,
          getText: (d) => (d.mobilisation?.profitPerMonth != null ? formatMoney(d.mobilisation.profitPerMonth) : ''),
          getNumber: (d) => Number(d.mobilisation?.profitPerMonth) || 0,
        }
      );
      // Three more month-specific commercial figures — only meaningful (and
      // only rendered) once a month is actually selected, same "don't show
      // a number these terms don't apply to" posture as everywhere else in
      // this file.
      if (monthFilter) {
        // That month's real OT amount off the matching monthlyHours entry —
        // gated by hasOtAmount too (belt and suspenders: both flags come
        // from the same server-side deploymentsHoursDecide check, but this
        // stays consistent with hasOtAmount's own long-standing "only if
        // the data actually has it" rule).
        if (hasOtAmount) {
          cols.push({
            key: 'mobMonthOtAmount',
            header: t('staffDeployments.overview.columns.otAmountThisMonth'),
            getText: (d) => {
              const entry = d.monthlyHours.find((m) => m.month === monthFilter);
              return entry?.otAmount != null ? formatMoney(entry.otAmount) : '';
            },
            getNumber: (d) => {
              const entry = d.monthlyHours.find((m) => m.month === monthFilter);
              return entry?.otAmount ?? 0;
            },
          });
        }
        // "Total amount we got" that month — regular + OT combined billing
        // (entry.contractHours × clientRate + otAmount), the user's own
        // explicit choice between that and "regular only" when asked
        // directly. Uses entry.contractHours (the snapshot taken AT THAT
        // MONTH's entry time), not the deployment's current
        // requiredTimesheetHours — same historically-accurate figure
        // deployment.service.js's own computeMonthlyProfit already reads.
        cols.push({
          key: 'mobMonthTotalAmount',
          header: t('staffDeployments.overview.columns.totalAmountThisMonth'),
          getNumber: (d) => {
            const entry = d.monthlyHours.find((m) => m.month === monthFilter);
            const regular = (entry?.contractHours ?? 0) * (Number(d.mobilisation?.clientRate) || 0);
            return regular + (entry?.otAmount ?? 0);
          },
          getText(d) {
            return formatMoney(this.getNumber(d));
          },
        });
        // The real, month-specific total — the estimate plus that month's
        // actual OT contribution (otProfitPerHour × the matching
        // monthlyHours entry's otHours; every row here passed the Month
        // filter, so that entry always exists).
        cols.push({
          key: 'mobTotalProfitPerMonth',
          header: t('staffDeployments.overview.columns.totalProfitPerMonth'),
          profit: true,
          getNumber: (d) => {
            const entry = d.monthlyHours.find((m) => m.month === monthFilter);
            const otProfit = (Number(d.mobilisation?.otProfitPerHour) || 0) * (entry?.otHours ?? 0);
            return (Number(d.mobilisation?.profitPerMonth) || 0) + otProfit;
          },
          getText(d) {
            return formatMoney(this.getNumber(d));
          },
        });
      }
    }
    return cols;
  }, [t, hasCommercialMobilisation, monthFilter, hasOtAmount]);

  // `columns` re-sorted against the user's own drag-and-drop order (see
  // this file's own module comment). Stale keys (a column that no longer
  // exists this render) are dropped silently; any column not yet in the
  // stored order (new, or nothing has ever been dragged) appends at the
  // end in its normal position — so toggling the Month filter on/off, or
  // a viewer's own commercial access, can never desync a saved
  // arrangement or crash on a missing column.
  const orderedColumns = useMemo(() => {
    if (!columnOrder) return columns;
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const ordered = columnOrder.filter((k) => byKey.has(k)).map((k) => byKey.get(k));
    const seen = new Set(ordered.map((c) => c.key));
    for (const c of columns) {
      if (!seen.has(c.key)) ordered.push(c);
    }
    return ordered;
  }, [columns, columnOrder]);

  function handleHeaderDrop(targetKey) {
    if (draggedKey && draggedKey !== targetKey) {
      const order = orderedColumns.map((c) => c.key);
      const from = order.indexOf(draggedKey);
      const to = order.indexOf(targetKey);
      if (from !== -1 && to !== -1) {
        const next = [...order];
        next.splice(from, 1);
        next.splice(to, 0, draggedKey);
        // Session-only (see this file's own module comment) — "Set as
        // default" in the Columns menu is the explicit, separate step that
        // actually persists this to localStorage.
        setColumnOrder(next);
      }
    }
    setDraggedKey(null);
    setDragOverKey(null);
  }

  // For an 'enum' column, the picklist is built from whatever values are
  // ACTUALLY present in the loaded data — a real Excel AutoFilter feel,
  // never a stale/theoretical option nothing currently uses.
  const enumOptions = useMemo(() => {
    const result = {};
    for (const col of columns) {
      if (col.type === 'enum') result[col.key] = uniqueSorted(rows.map((d) => col.getValue(d)));
    }
    return result;
  }, [columns, rows]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v);
    return rows.filter((d) => {
      if (monthFilter && !d.monthlyHours.some((m) => m.month === monthFilter)) return false;
      return active.every(([key, filterValue]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        if (col.type === 'enum') return col.getValue(d) === filterValue;
        return col.getText(d).toLowerCase().includes(filterValue.toLowerCase());
      });
    });
  }, [rows, filters, columns, monthFilter]);

  const hasActiveFilters = Object.values(filters).some(Boolean) || Boolean(monthFilter);

  function goToDeployment(id) {
    onClose();
    navigate(`/deployments/${id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title={t('staffDeployments.overview.modalTitle')} size="screen">
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {t('staffDeployments.overview.rowCount', { shown: filteredRows.length, total: rows.length })}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              {t('staffDeployments.overview.yearFilterLabel')}
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                aria-label={t('staffDeployments.overview.yearFilterLabel')}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text"
              >
                <option value="">{t('staffDeployments.overview.selectYear')}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              {t('staffDeployments.overview.monthFilterLabel')}
              <select
                value={filterMonthNum}
                onChange={(e) => setFilterMonthNum(e.target.value)}
                aria-label={t('staffDeployments.overview.monthFilterLabel')}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text"
              >
                <option value="">{t('staffDeployments.overview.selectMonth')}</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilters({});
                  setFilterYear('');
                  setFilterMonthNum('');
                }}
              >
                {t('staffDeployments.overview.clearFilters')}
              </Button>
            )}
            <div className="relative" ref={columnsMenuRef}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setColumnsMenuOpen((v) => !v)}
                aria-expanded={columnsMenuOpen}
                aria-haspopup="menu"
              >
                {t('staffDeployments.overview.columnsMenuLabel')}
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={cn('h-3 w-3 transition-transform', columnsMenuOpen && 'rotate-180')}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
                </svg>
              </Button>
              {columnsMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 sm:left-auto sm:right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!columnOrder}
                    onClick={setColumnOrderAsDefault}
                    className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                  >
                    {t('staffDeployments.overview.setColumnsAsDefault')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!columnOrder}
                    onClick={resetColumnOrder}
                    className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                  >
                    {t('staffDeployments.overview.resetColumns')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : isError ? (
          <EmptyState title={t('staffDeployments.list.couldNotLoad')} description={t('staffDeployments.list.couldNotLoadDescription')} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('staffDeployments.overview.emptyTitle')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border">
                  {orderedColumns.map((col) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={(e) => {
                        setDraggedKey(col.key);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverKey !== col.key) setDragOverKey(col.key);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleHeaderDrop(col.key);
                      }}
                      onDragEnd={() => {
                        setDraggedKey(null);
                        setDragOverKey(null);
                      }}
                      title={t('staffDeployments.overview.dragColumnHint')}
                      className={cn(
                        'group cursor-grab select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted active:cursor-grabbing',
                        draggedKey === col.key && 'opacity-40',
                        dragOverKey === col.key && draggedKey !== col.key && 'bg-primary/10 ring-1 ring-inset ring-primary/50'
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50">
                          <circle cx="5" cy="3" r="1.3" />
                          <circle cx="11" cy="3" r="1.3" />
                          <circle cx="5" cy="8" r="1.3" />
                          <circle cx="11" cy="8" r="1.3" />
                          <circle cx="5" cy="13" r="1.3" />
                          <circle cx="11" cy="13" r="1.3" />
                        </svg>
                        {col.header}
                      </span>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-bg/40">
                  {orderedColumns.map((col) => (
                    <th key={col.key} className="px-3 py-1.5">
                      {col.type === 'enum' ? (
                        <select
                          value={filters[col.key] ?? ''}
                          onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
                          className="h-8 w-full min-w-[110px] rounded-md border border-border bg-surface px-2 text-xs text-text"
                        >
                          <option value="">{t('staffDeployments.overview.allValues')}</option>
                          {enumOptions[col.key]?.map((v) => (
                            <option key={v} value={v}>
                              {col.key === 'workerType'
                                ? t(`staffMobilisations.form.workerType.${v}`, v)
                                : col.key === 'status'
                                  ? t(`staffDeployments.status.${v}`, v)
                                  : col.key === 'mobFtaType'
                                    ? t(`staffMobilisations.form.ftaType.${v}`, v)
                                    : t(`staffDeployments.reasons.${v}`, v)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={filters[col.key] ?? ''}
                          onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
                          placeholder={t('staffDeployments.overview.filterPlaceholder')}
                          className="h-8 w-full min-w-[110px] rounded-md border border-border bg-surface px-2 text-xs text-text placeholder:text-muted/70"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    {/* left-aligned, not centered: this cell's colSpan covers
                        every column (now ~30 wide with the Mobilisation
                        columns), so centered text would render far past the
                        right edge of the visible, left-scrolled viewport —
                        found live while verifying this exact empty state. */}
                    <td colSpan={columns.length} className="px-3 py-8 text-left text-sm text-muted">
                      {monthFilter
                        ? t('staffDeployments.overview.noDeploymentsForMonth', { month: monthLabel(monthFilter) })
                        : t('common.tryClearingFilters')}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((d) => (
                    <tr key={d._id} onClick={() => goToDeployment(d._id)} className="cursor-pointer transition-colors hover:bg-primary/[0.035]">
                      {orderedColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn('whitespace-nowrap px-3 py-2', (col.profit && profitClass(col.getNumber(d))) || 'text-text')}
                        >
                          {col.getText(d) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {hasCommercialMobilisation && (
                <tfoot className="sticky bottom-0 z-10 bg-surface">
                  <tr className="border-t-2 border-border">
                    {orderedColumns.map((col, i) => {
                      if (!col.getNumber) {
                        return (
                          <td key={col.key} className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            {i === 0 ? t('staffDeployments.overview.totalRowLabel') : ''}
                          </td>
                        );
                      }
                      const sum = filteredRows.reduce((s, d) => s + col.getNumber(d), 0);
                      return (
                        <td
                          key={col.key}
                          className={cn('whitespace-nowrap px-3 py-2 font-semibold', (col.profit && profitClass(sum)) || 'text-text')}
                        >
                          {formatMoney(sum)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
