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

export default function DeploymentOverviewModal({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
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
    // hasCommercialMobilisation above) ---
    if (hasCommercialMobilisation) {
      cols.push(
        {
          key: 'mobClientRate',
          header: t('staffMobilisations.detail.fields.clientRate'),
          getText: (d) => (d.mobilisation?.clientRate ? formatMoney(d.mobilisation.clientRate) : ''),
        },
        {
          key: 'mobClientCommission',
          header: t('staffMobilisations.detail.fields.clientCommission'),
          getText: (d) => (d.mobilisation?.clientCommission ? formatMoney(d.mobilisation.clientCommission) : ''),
        },
        {
          key: 'mobSubcontractorRate',
          header: t('staffMobilisations.detail.fields.subcontractorRate'),
          getText: (d) => (d.mobilisation?.subcontractorRate ? formatMoney(d.mobilisation.subcontractorRate) : ''),
        },
        {
          key: 'mobSubcontractorCommission',
          header: t('staffMobilisations.detail.fields.subcontractorCommission'),
          getText: (d) => (d.mobilisation?.subcontractorCommission ? formatMoney(d.mobilisation.subcontractorCommission) : ''),
        },
        {
          key: 'mobOtClientRate',
          header: t('staffMobilisations.detail.fields.otClientRate'),
          getText: (d) => (d.mobilisation?.otClientRate ? formatMoney(d.mobilisation.otClientRate) : ''),
        },
        {
          key: 'mobOtEmployeeRate',
          header: t('staffMobilisations.detail.fields.otEmployeeRate'),
          getText: (d) => (d.mobilisation?.otEmployeeRate ? formatMoney(d.mobilisation.otEmployeeRate) : ''),
        },
        {
          key: 'mobProfitPerHour',
          header: t('staffMobilisations.detail.fields.profitPerHour'),
          getText: (d) => (d.mobilisation?.profitPerHour != null ? formatMoney(d.mobilisation.profitPerHour) : ''),
        },
        {
          key: 'mobProfitPerMonth',
          header: t('staffMobilisations.detail.fields.profitPerMonth'),
          getText: (d) => (d.mobilisation?.profitPerMonth != null ? formatMoney(d.mobilisation.profitPerMonth) : ''),
        },
        {
          key: 'mobOtProfitPerHour',
          header: t('staffMobilisations.detail.fields.otProfitPerHour'),
          getText: (d) => (d.mobilisation?.otProfitPerHour != null ? formatMoney(d.mobilisation.otProfitPerHour) : ''),
        }
      );
    }
    return cols;
  }, [t, hasCommercialMobilisation]);

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
    if (active.length === 0) return rows;
    return rows.filter((d) =>
      active.every(([key, filterValue]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        if (col.type === 'enum') return col.getValue(d) === filterValue;
        return col.getText(d).toLowerCase().includes(filterValue.toLowerCase());
      })
    );
  }, [rows, filters, columns]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function goToDeployment(id) {
    onClose();
    navigate(`/deployments/${id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title={t('staffDeployments.overview.modalTitle')} size="screen">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {t('staffDeployments.overview.rowCount', { shown: filteredRows.length, total: rows.length })}
          </p>
          {hasActiveFilters && (
            <Button size="sm" variant="secondary" onClick={() => setFilters({})}>
              {t('staffDeployments.overview.clearFilters')}
            </Button>
          )}
        </div>

        {isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : isError ? (
          <EmptyState title={t('staffDeployments.list.couldNotLoad')} description={t('staffDeployments.list.couldNotLoadDescription')} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('staffDeployments.overview.emptyTitle')} />
        ) : (
          <div className="max-h-[calc(97vh-170px)] overflow-auto rounded-xl border border-border">
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
                            <td key={col.key} className="whitespace-nowrap px-3 py-2 text-text">
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
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
