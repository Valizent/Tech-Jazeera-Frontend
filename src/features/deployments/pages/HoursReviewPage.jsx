/**
 * HoursReviewPage — the manager's dedicated approval queue for monthly
 * timesheet hours. Shows every Pending entry across all deployments with
 * enough context (worker, client, month, hours breakdown) to Approve or
 * Reject without having to navigate into the full deployment detail page.
 *
 * Gated by deploymentsHoursDecide write access (same key as the decide
 * endpoint itself). Edit still navigates to the full deployment detail page
 * since correcting hours is an Office Secretary action, not a manager one.
 *
 * 2026-09-28: initial implementation. 2026-09-29: given full i18n (a real
 * audit finding — this shipped 100% hardcoded English, a regression against
 * the app's staff-panel Arabic convention every sibling financial page
 * already follows, including PaymentsDuePage.jsx right next to it).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getPendingHoursQueue, decideMonthlyHours } from '../deployments.api.js';
import { apiMessage, formatMoney } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** A single data tile inside the approve/reject confirmation modal */
function StatTile({ label, value, valueClass = '' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-bg p-3">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`text-base font-semibold tabular-nums ${valueClass}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function HoursReviewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [decidingRow, setDecidingRow] = useState(null); // { ...row, action: 'Approved' | 'Rejected' }
  const [breakdownRow, setBreakdownRow] = useState(null);
  const [note, setNote] = useState('');

  const canDecide = Boolean(user.sectionAccessWrite?.includes('deploymentsHoursDecide'));

  const { data: rows, isPending, isError, refetch } = useQuery({
    queryKey: ['deployments', 'pending-hours'],
    queryFn: getPendingHoursQueue,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const decideMutation = useMutation({
    mutationFn: ({ deploymentId, entryId, decision, note: n }) =>
      decideMonthlyHours(deploymentId, entryId, { decision, note: n || undefined }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'Approved' ? t('staffDeployments.hoursReview.approvedToast') : t('staffDeployments.hoursReview.rejectedToast'));
      setDecidingRow(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['deployments', 'pending-hours'] });
      qc.invalidateQueries({ queryKey: ['deployments'] });
    },
    onError: (err) => toast.error(apiMessage(err)),
  });

  function openModal(row, action) {
    setDecidingRow({ ...row, action });
    setNote('');
  }

  function closeModal() {
    if (decideMutation.isPending) return;
    setDecidingRow(null);
    setNote('');
  }

  if (!canDecide) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title={t('staffDeployments.hoursReview.accessRestrictedTitle')}
          description={t('staffDeployments.hoursReview.accessRestrictedDescription')}
          action={<Button variant="secondary" onClick={() => navigate(-1)}>{t('common.back')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t('staffDeployments.hoursReview.pageTitle')}
        description={t('staffDeployments.hoursReview.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          rows?.length > 0 && (
            <Badge variant="warning">{t('staffDeployments.hoursReview.pendingBadge', { count: rows.length })}</Badge>
          )
        }
      />

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title={t('staffDeployments.hoursReview.loadFailedTitle')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            {/* Checkmark illustration */}
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-base font-semibold text-text">{t('staffDeployments.hoursReview.allCaughtUpTitle')}</p>
            <p className="text-sm text-muted">{t('staffDeployments.hoursReview.allCaughtUpDescription')}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={`${row.deploymentId}-${row.entryId}`}
              className="group rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md"
            >
              {/* Header strip */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{row.workerName}</span>
                    <span className="text-muted">·</span>
                    <Link
                      to={`/deployments/${row.deploymentId}`}
                      className="text-sm text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.clientName}
                    </Link>
                    {row.site && <span className="text-sm text-muted">· {row.site}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="warning">{t('common.status.Pending')}</Badge>
                    <span className="text-xs font-medium text-muted">{row.month}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to={`/deployments/${row.deploymentId}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-bg px-3 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-text"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M11.333 2.667L13.333 4.667L5.333 12.667H3.333V10.667L11.333 2.667Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t('common.edit')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => openModal(row, 'Approved')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-success/10 px-3 text-xs font-semibold text-success transition-colors hover:bg-success/20"
                    id={`approve-${row.entryId}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t('common.approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal(row, 'Rejected')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger/10 px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                    id={`reject-${row.entryId}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    {t('common.reject')}
                  </button>
                </div>
              </div>

              {/* Hours grid */}
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {[
                  { label: t('staffDeployments.hoursReview.columns.contractHours'), value: row.contractHours },
                  { label: t('staffDeployments.hoursReview.columns.clientTimesheet'), value: row.actualHours },
                  ...(row.workerType === 'SupplierEmployee'
                    ? [{ label: t('staffDeployments.hoursReview.columns.supplierTimesheet'), value: row.supplierHours ?? '—' }]
                    : []),
                  { label: t('staffDeployments.hoursReview.columns.otHours'), value: row.otHours },
                  ...(row.otAmount != null ? [{ label: t('staffDeployments.hoursReview.columns.otAmount'), value: formatMoney(row.otAmount) }] : []),
                  ...(row.deductionAmount > 0 ? [{ label: t('staffDeployments.hoursReview.columns.deduction'), value: formatMoney(row.deductionAmount), valueClass: 'text-danger' }] : []),
                  ...(row.revenue != null ? [{ label: t('staffDeployments.hoursReview.columns.invoiceAmount'), value: formatMoney(row.revenue) }] : []),
                  ...(row.profit != null ? [{
                      label: t('staffDeployments.hoursReview.columns.netProfit'),
                      value: formatMoney(row.profit),
                      valueClass: row.profit < 0 ? 'text-danger' : 'text-success',
                      onClick: () => setBreakdownRow(row)
                  }] : []),
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className={`bg-surface px-5 py-3 ${tile.onClick ? 'cursor-pointer transition-colors hover:bg-bg' : ''}`}
                    onClick={tile.onClick}
                  >
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                      {tile.label}
                      {tile.onClick && (
                        <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </p>
                    <p className={`mt-0.5 text-sm font-semibold tabular-nums ${tile.valueClass ?? ''}`}>{tile.value}</p>
                  </div>
                ))}
              </div>

              {row.notes && (
                <div className="border-t border-border px-5 py-3">
                  <p className="text-xs text-muted">{row.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve / Reject modal */}
      <Modal
        open={Boolean(decidingRow)}
        onClose={closeModal}
        title={
          decidingRow
            ? t(decidingRow.action === 'Approved' ? 'staffDeployments.hoursReview.approveModalTitle' : 'staffDeployments.hoursReview.rejectModalTitle', { month: decidingRow.month })
            : ''
        }
      >
        {decidingRow && (
          <div className="space-y-5">
            {/* Context */}
            <div>
              <p className="text-sm font-medium text-text">
                {decidingRow.workerName}
                <span className="font-normal text-muted"> · {decidingRow.clientName}</span>
                {decidingRow.site && <span className="font-normal text-muted"> · {decidingRow.site}</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">{t('staffDeployments.hoursReview.timesheetPeriod', { month: decidingRow.month })}</p>
            </div>

            {/* Hours summary grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label={t('staffDeployments.hoursReview.columns.contractHours')} value={decidingRow.contractHours} />
              <StatTile label={t('staffDeployments.hoursReview.columns.clientTimesheet')} value={decidingRow.actualHours} />
              {decidingRow.workerType === 'SupplierEmployee' && (
                <StatTile label={t('staffDeployments.hoursReview.columns.supplierTimesheet')} value={decidingRow.supplierHours ?? '—'} />
              )}
              <StatTile label={t('staffDeployments.hoursReview.columns.otHours')} value={decidingRow.otHours} />
              {decidingRow.otAmount != null && (
                <StatTile label={t('staffDeployments.hoursReview.columns.otAmount')} value={formatMoney(decidingRow.otAmount)} />
              )}
              {decidingRow.deductionAmount > 0 && (
                <StatTile
                  label={t('staffDeployments.hoursReview.clientDeductionLabel')}
                  value={formatMoney(decidingRow.deductionAmount)}
                  valueClass="text-danger"
                />
              )}
              {decidingRow.revenue != null && (
                <StatTile label={t('staffDeployments.hoursReview.columns.invoiceAmount')} value={formatMoney(decidingRow.revenue)} />
              )}
              {decidingRow.profit != null && (
                <div
                  className="group cursor-pointer rounded-xl outline-none ring-2 ring-transparent transition-all hover:bg-bg/50 hover:ring-primary/20"
                  onClick={() => setBreakdownRow(decidingRow)}
                >
                  <StatTile
                    label={
                      <span className="flex items-center gap-1.5">
                        {t('staffDeployments.hoursReview.columns.netProfit')}
                        <svg className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    }
                    value={formatMoney(decidingRow.profit)}
                    valueClass={decidingRow.profit < 0 ? 'text-danger' : 'text-success'}
                  />
                </div>
              )}
            </div>

            {/* Note */}
            <Textarea
              label={decidingRow.action === 'Rejected' ? t('staffDeployments.hoursReview.reasonRequiredLabel') : t('staffDeployments.hoursReview.noteOptionalLabel')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                decidingRow.action === 'Rejected'
                  ? t('staffDeployments.hoursReview.rejectPlaceholder')
                  : t('staffDeployments.hoursReview.notePlaceholder')
              }
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={decideMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={decidingRow.action === 'Approved' ? 'primary' : 'danger'}
                isLoading={decideMutation.isPending}
                disabled={decidingRow.action === 'Rejected' && !note.trim()}
                onClick={() =>
                  decideMutation.mutate({
                    deploymentId: decidingRow.deploymentId,
                    entryId: decidingRow.entryId,
                    decision: decidingRow.action,
                    note,
                  })
                }
              >
                {decidingRow.action === 'Approved' ? t('common.approve') : t('common.reject')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Breakdown modal */}
      <Modal
        open={Boolean(breakdownRow)}
        onClose={() => setBreakdownRow(null)}
        title={t('staffDeployments.hoursReview.breakdownModalTitle', { month: breakdownRow?.month })}
        size="sm"
      >
        {breakdownRow && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.clientInvoiceAmount')}</span>
                <span className="font-medium tabular-nums">{formatMoney(breakdownRow.profitBreakdown?.clientInvoiceAmount)}</span>
              </div>

              <div className="my-2 border-b border-border"></div>

              {breakdownRow.workerType === 'SupplierEmployee' && breakdownRow.profitBreakdown?.subContractorInvoiceAmount !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.subContractorInvoiceAmount')}</span>
                  {/* Can go negative (2026-09-30, the user's own ask) when a
                      supplier deduction exceeds the raw rate×hours amount —
                      that's money we KEEP, not spend, so it flips to a "+"
                      green line here instead of the usual "-" red one. */}
                  <span className={`font-medium tabular-nums ${breakdownRow.profitBreakdown.subContractorInvoiceAmount > 0 ? 'text-danger' : 'text-success'}`}>
                    {breakdownRow.profitBreakdown.subContractorInvoiceAmount > 0 ? '-' : '+'}
                    {formatMoney(Math.abs(breakdownRow.profitBreakdown.subContractorInvoiceAmount))}
                  </span>
                </div>
              )}
              {breakdownRow.workerType === 'SupplierEmployee' && breakdownRow.profitBreakdown?.expenseSubCommission > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.subCommission')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseSubCommission)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.otCalculations > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.otCalculations')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.otCalculations)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.expenseClientCommission > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.clientCommission')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseClientCommission)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.expenseFta > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.fta')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseFta)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.expenseAllowance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.allowance')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseAllowance)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.expenseDeduction > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.clientDeduction')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseDeduction)}</span>
                </div>
              )}
              {breakdownRow.profitBreakdown?.expenseMobilisationCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('staffDeployments.hoursReview.breakdown.mobilisationCost')}</span>
                  <span className="font-medium tabular-nums text-danger">-{formatMoney(breakdownRow.profitBreakdown?.expenseMobilisationCost)}</span>
                </div>
              )}

              <div className="my-2 border-b border-border"></div>

              <div className="flex justify-between pt-1">
                <span className="font-semibold text-text">{t('staffDeployments.hoursReview.breakdown.netProfit')}</span>
                <span className={`font-semibold tabular-nums ${breakdownRow.profit < 0 ? 'text-danger' : 'text-success'}`}>
                  {formatMoney(breakdownRow.profit)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={() => setBreakdownRow(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
