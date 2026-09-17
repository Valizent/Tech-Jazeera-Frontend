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
 */
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDeployments } from '../deployments.api.js';
import { formatDate, formatMoney, cn } from '../../../lib/utils.js';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const OVERVIEW_ROW_LIMIT = 5000;

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

// Same convention as MobilisationDetailPage.jsx's own profitClass — reused
// here, not reinvented, so a profit figure reads the same color everywhere
// it appears in the app.
function profitClass(amount) {
  if (amount > 0) return 'text-success';
  if (amount < 0) return 'text-danger';
  return undefined;
}

export default function DeploymentOverviewModal({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
  const [monthFilter, setMonthFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // Every month any deployment actually has a monthlyHours entry for — the
  // Month filter's own options, same "built from what's actually present"
  // convention as enumOptions below. Raw 'YYYY-MM' strings, not a friendlier
  // format — matches how a month already reads everywhere else in this same
  // modal (the expanded monthly-hours sub-table's own Month column).
  const monthOptions = useMemo(
    () => uniqueSorted(rows.flatMap((d) => d.monthlyHours.map((m) => m.month))),
    [rows]
  );

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
      },
      {
        key: 'mobAllowanceRemark',
        header: t('staffMobilisations.detail.fields.allowanceRemark'),
        getText: (d) => d.mobilisation?.allowanceRemark ?? '',
      },
    ];
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
      // The real, month-specific total — the estimate plus that month's
      // actual OT contribution (otProfitPerHour × the matching monthlyHours
      // entry's otHours; every row here passed the Month filter, so that
      // entry always exists). Only meaningful once a month is actually
      // selected — hidden in the normal, unfiltered view (the user's own
      // ask): an "estimate + 0 OT" number for a month nobody picked would
      // just be a confusing duplicate of profitPerMonth itself.
      if (monthFilter) {
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
  }, [t, hasCommercialMobilisation, monthFilter]);

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

  // otAmount is commercial (see this file's own header comment) — the
  // server already strips it entirely for anyone without
  // 'deploymentsHoursDecide' access, so its presence on even one loaded
  // entry is a reliable, no-extra-request signal that the whole response
  // has it. Never re-derived from the viewer's own role client-side.
  const hasOtAmount = useMemo(() => rows.some((d) => d.monthlyHours.some((m) => m.otAmount !== undefined)), [rows]);

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

  // Every column with a getNumber — the commercial rate/commission/profit
  // group, plus the conditional Total-profit-per-month column when it's
  // showing — powers the sticky totals row below.
  const summableColumns = useMemo(() => columns.filter((c) => c.getNumber), [columns]);

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
            {hasCommercialMobilisation && monthOptions.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                {t('staffDeployments.overview.monthFilterLabel')}
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  aria-label={t('staffDeployments.overview.monthFilterLabel')}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text"
                >
                  <option value="">{t('staffDeployments.overview.allMonths')}</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilters({});
                  setMonthFilter('');
                }}
              >
                {t('staffDeployments.overview.clearFilters')}
              </Button>
            )}
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
                  <th className="w-9 px-2 py-2" aria-hidden="true" />
                  {columns.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      {col.header}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-bg/40">
                  <th className="w-9 px-2 py-1.5" aria-hidden="true" />
                  {columns.map((col) => (
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
                    <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-sm text-muted">
                      {t('common.tryClearingFilters')}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((d) => {
                    const expanded = expandedIds.has(d._id);
                    const months = [...d.monthlyHours].sort((a, b) => a.month.localeCompare(b.month));
                    return (
                      <Fragment key={d._id}>
                        <tr
                          onClick={() => goToDeployment(d._id)}
                          className="cursor-pointer transition-colors hover:bg-primary/[0.035]"
                        >
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(d._id);
                              }}
                              aria-expanded={expanded}
                              aria-label={
                                expanded
                                  ? t('staffDeployments.overview.collapseMonthlyHours')
                                  : t('staffDeployments.overview.expandMonthlyHours')
                              }
                              className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-border/60 hover:text-text"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={cn('whitespace-nowrap px-3 py-2', (col.profit && profitClass(col.getNumber(d))) || 'text-text')}
                            >
                              {col.getText(d) || '—'}
                            </td>
                          ))}
                        </tr>
                        {expanded && (
                          <tr className="bg-bg/30">
                            <td colSpan={columns.length + 1} className="px-4 py-3">
                              {months.length === 0 ? (
                                <p className="text-xs text-muted">{t('staffDeployments.overview.noMonthlyHours')}</p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border bg-surface">
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.month')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.contractHours')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.actualHours')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.daysWorked')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.otHours')}
                                        </th>
                                        {hasOtAmount && (
                                          <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                            {t('staffDeployments.detail.columns.otAmount')}
                                          </th>
                                        )}
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.deduction')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.columns.status')}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-muted">
                                          {t('staffDeployments.detail.notesLabel')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {months.map((m) => (
                                        <tr key={m._id ?? m.month} onClick={(e) => e.stopPropagation()}>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">{m.month}</td>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">{m.contractHours}</td>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">{m.actualHours}</td>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">{m.daysWorked || '—'}</td>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">{m.otHours}</td>
                                          {hasOtAmount && (
                                            <td className="whitespace-nowrap px-2 py-1.5 text-text">
                                              {m.otAmount != null ? formatMoney(m.otAmount) : '—'}
                                            </td>
                                          )}
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">
                                            {m.deductionAmount ? formatMoney(m.deductionAmount) : '—'}
                                          </td>
                                          <td className="whitespace-nowrap px-2 py-1.5 text-text">
                                            {t(`staffDeployments.detail.hoursStatus.${m.status}`, m.status)}
                                          </td>
                                          <td className="px-2 py-1.5 text-text">{m.notes || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
              {hasCommercialMobilisation && summableColumns.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-surface">
                  <tr className="border-t-2 border-border">
                    <td
                      colSpan={columns.length - summableColumns.length + 1}
                      className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {t('staffDeployments.overview.totalRowLabel')}
                    </td>
                    {summableColumns.map((col) => {
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
