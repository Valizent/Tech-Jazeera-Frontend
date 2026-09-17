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

  // Columns match deployment.export.js's own list exactly, so the modal and
  // the downloaded .xlsx always read the same way. `getText` is what both
  // the free-text filter and the cell itself use — one source, so a column
  // never filters on text different from what's actually on screen.
  const columns = useMemo(
    () => [
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
    ],
    [t]
  );

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
    <Modal open={open} onClose={onClose} title={t('staffDeployments.overview.modalTitle')} size="full">
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
          <div className="max-h-[65vh] overflow-auto rounded-xl border border-border">
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
