/**
 * PaymentsDuePage — one row per CLIENT with at least one outstanding
 * invoice (2026-09-27 redesign, the user's own correction: a client pays in
 * bulk for everyone placed there in a month, never per worker — see
 * server/docs/CLIENT-PAYMENTS-notes.md). A Coordinator sees only clients
 * where they coordinate at least one of the deployments behind an
 * outstanding invoice; anyone with 'mobilisationsViewer' (this company's
 * real MM already holds it, plus Admin) sees every client. No dedicated
 * Section Access gate on the route itself — the data is already correctly
 * scoped server-side, same reasoning MobilisationDetailPage's own
 * worker-history page gives for skipping a Section Access key on a
 * narrowly-scoped page.
 *
 * Clicking a client drills into every invoice behind their balance (each
 * with its own live FIFO allocation) plus their real payment history.
 * Record Payment (Office Secretary / `deploymentsHours`) and Approve/Reject
 * (`deploymentsPaymentDecide`, the Financial Manager) both live in that
 * drill-down — moved here from the Deployment detail page, which now shows
 * only a read-only status.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPaymentsDue, getClientPaymentDetail, recordClientPayment, decideClientPayment } from '../deployments.api.js';
import { formatDate, formatMoney, apiMessage } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function urgencyVariant(daysRemaining) {
  if (daysRemaining == null) return 'default';
  if (daysRemaining < 0) return 'danger';
  if (daysRemaining <= 5) return 'warning';
  return 'default';
}

export default function PaymentsDuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const canRecordPayment = user.role === 'Office Secretary' || Boolean(user.sectionAccessWrite?.includes('deploymentsHours'));
  const canDecidePayment = Boolean(user.sectionAccessWrite?.includes('deploymentsPaymentDecide'));

  const [supplierFilter, setSupplierFilter] = useState('');
  const [openClientId, setOpenClientId] = useState(null);
  const [payingClient, setPayingClient] = useState(null); // { clientId, clientName } | null
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [decidingPayment, setDecidingPayment] = useState(null); // payment row | null
  const [payDecision, setPayDecision] = useState(null); // 'Approved' | 'Rejected'
  const [payDecisionNote, setPayDecisionNote] = useState('');

  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'payments-due'],
    queryFn: getPaymentsDue,
  });

  const { data: detail, isPending: detailPending } = useQuery({
    queryKey: ['deployments', 'payments-due', openClientId],
    queryFn: () => getClientPaymentDetail(openClientId),
    enabled: Boolean(openClientId),
  });

  const supplierOptions = useMemo(() => {
    const set = new Set();
    for (const row of rows) for (const name of row.subcontractorNames ?? []) set.add(name);
    return [...set].sort();
  }, [rows]);

  const filteredRows = supplierFilter ? rows.filter((row) => row.subcontractorNames?.includes(supplierFilter)) : rows;

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['deployments', 'payments-due'] });

  const recordMutation = useMutation({
    mutationFn: ({ clientId, values }) => recordClientPayment(clientId, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.paymentsDue.paymentRecordedToast'));
      setPayingClient(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      invalidateList();
      if (openClientId) queryClient.invalidateQueries({ queryKey: ['deployments', 'payments-due', openClientId] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const decideMutation = useMutation({
    mutationFn: ({ paymentId, values }) => decideClientPayment(paymentId, values),
    onSuccess: () => {
      toast.success(
        payDecision === 'Approved' ? t('staffDeployments.paymentsDue.paymentApprovedToast') : t('staffDeployments.paymentsDue.paymentRejectedToast')
      );
      setDecidingPayment(null);
      setPayDecision(null);
      setPayDecisionNote('');
      invalidateList();
      if (openClientId) queryClient.invalidateQueries({ queryKey: ['deployments', 'payments-due', openClientId] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    { key: 'client', header: t('staffDeployments.paymentsDue.columns.client'), render: (row) => <span className="font-medium text-text">{row.clientName}</span> },
    { key: 'count', header: t('staffDeployments.paymentsDue.columns.invoiceCount'), render: (row) => row.outstandingCount },
    { key: 'total', header: t('staffDeployments.paymentsDue.columns.totalOutstanding'), render: (row) => formatMoney(row.totalOutstanding) },
    {
      key: 'due',
      header: t('staffDeployments.paymentsDue.columns.due'),
      render: (row) => (
        <Badge variant={urgencyVariant(row.daysRemaining)}>
          {row.daysRemaining == null
            ? '—'
            : row.daysRemaining < 0
              ? t('staffDeployments.paymentsDue.overdueBy', { days: Math.abs(row.daysRemaining) })
              : t('staffDeployments.paymentsDue.dueInDays', { days: row.daysRemaining })}
        </Badge>
      ),
    },
  ];

  if (canRecordPayment) {
    columns.push({
      key: 'action',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setPayingClient({ clientId: row.clientId, clientName: row.clientName });
          }}
        >
          {t('staffDeployments.paymentsDue.recordPaymentButton')}
        </Button>
      ),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.paymentsDue.pageTitle')}
        description={t('staffDeployments.paymentsDue.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          canDecidePayment ? (
            <Button size="sm" variant="primary" onClick={() => navigate('/financial/payments-review')} className="relative">
              Review Pending Payments
            </Button>
          ) : null
        }
      />

      {supplierOptions.length > 0 && (
        <div className="max-w-xs">
          <Select label={t('staffDeployments.paymentsDue.filterBySupplier')} value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">{t('staffDeployments.paymentsDue.allSuppliers')}</option>
            {supplierOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.paymentsDue.couldNotLoad')} description={t('common.checkConnection')} />
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.clientId}
            onRowClick={(row) => setOpenClientId(row.clientId)}
            emptyState={
              <EmptyState
                title={t('staffDeployments.paymentsDue.emptyTitle')}
                description={t('staffDeployments.paymentsDue.emptyDescription')}
              />
            }
          />
        </Card>
      )}

      {/* Client drill-down: every invoice behind the balance + real payment history. */}
      <Modal open={Boolean(openClientId)} onClose={() => setOpenClientId(null)} title={detail?.clientName ?? ''} size="xl">
        {detailPending ? (
          <Skeleton className="h-40 w-full" />
        ) : detail ? (
          <div className="space-y-5">
            {detail.creditBalance > 0 && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                {t('staffDeployments.paymentsDue.creditBalance', { amount: formatMoney(detail.creditBalance) })}
              </p>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.paymentsDue.invoicesTitle')}</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg/40 text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2">{t('staffDeployments.paymentsDue.columns.worker')}</th>
                      <th className="px-3 py-2">{t('staffDeployments.paymentsDue.columns.month')}</th>
                      <th className="px-3 py-2">{t('staffDeployments.paymentsDue.columns.invoice')}</th>
                      <th className="px-3 py-2">{t('staffDeployments.paymentsDue.columns.allocated')}</th>
                      <th className="px-3 py-2">{t('staffDeployments.paymentsDue.columns.balance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detail.invoices.map((inv) => (
                      <tr key={inv.entryId}>
                        <td className="px-3 py-2">{inv.workerName}</td>
                        <td className="px-3 py-2">{inv.month}</td>
                        <td className="px-3 py-2">
                          {inv.invoiceNumber ?? '—'}
                          {inv.invoiceDate && <span className="block text-xs text-muted">{formatDate(inv.invoiceDate)}</span>}
                        </td>
                        <td className="px-3 py-2">{formatMoney(inv.amountAllocated)}</td>
                        <td className="px-3 py-2">
                          {inv.fullyPaid ? (
                            <Badge variant="success">{t('staffDeployments.paymentsDue.fullyPaid')}</Badge>
                          ) : (
                            formatMoney(inv.balanceDue)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.paymentsDue.paymentHistoryTitle')}</h3>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-muted">{t('staffDeployments.paymentsDue.noPaymentsYet')}</p>
              ) : (
                <ul className="space-y-2">
                  {detail.payments.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-text">{formatMoney(p.amount)}</span>
                        {p.paymentReference && <span className="ml-2 text-xs font-mono text-muted">{p.paymentReference}</span>}
                        <span className="ml-2 text-xs text-muted">
                          {p.recordedBy?.name} · {formatDate(p.paymentDate || p.recordedAt)}
                        </span>
                      </div>
                      {p.decisionStatus === 'Pending' ? (
                        canDecidePayment ? (
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDecidingPayment(p);
                                setPayDecision('Approved');
                                setPayDecisionNote('');
                              }}
                            >
                              {t('common.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-ghost"
                              onClick={() => {
                                setDecidingPayment(p);
                                setPayDecision('Rejected');
                                setPayDecisionNote('');
                              }}
                            >
                              {t('common.reject')}
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="warning">{t('staffDeployments.paymentsDue.statusPending')}</Badge>
                        )
                      ) : p.decisionStatus === 'Approved' ? (
                        <Badge variant="success">{t('staffDeployments.paymentsDue.statusApproved')}</Badge>
                      ) : (
                        <Badge variant="danger">{t('staffDeployments.paymentsDue.statusRejected')}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canRecordPayment && (
              <div className="flex justify-end">
                <Button onClick={() => setPayingClient({ clientId: detail.clientId, clientName: detail.clientName })}>
                  {t('staffDeployments.paymentsDue.recordPaymentButton')}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Record a bulk payment for one client. */}
      <Modal
        open={Boolean(payingClient)}
        onClose={() => {
          if (recordMutation.isPending) return;
          setPayingClient(null);
          setPaymentAmount('');
          setPaymentReference('');
          setPaymentDate(new Date().toISOString().split('T')[0]);
        }}
        title={payingClient ? t('staffDeployments.paymentsDue.recordPaymentModalTitle', { client: payingClient.clientName }) : ''}
      >
        {payingClient && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('staffDeployments.paymentsDue.recordPaymentModalMessage')}</p>
            <Input
              label={t('staffDeployments.paymentsDue.amountLabel', 'Amount received *')}
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('staffDeployments.paymentsDue.paymentReferenceLabel', 'Invoice / Reference #')}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Optional"
              />
              <Input
                label={t('staffDeployments.paymentsDue.paymentDateLabel', 'Payment Date')}
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setPayingClient(null)} disabled={recordMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                isLoading={recordMutation.isPending}
                disabled={!paymentAmount || Number(paymentAmount) <= 0 || !paymentDate}
                onClick={() => recordMutation.mutate({ clientId: payingClient.clientId, values: { amount: Number(paymentAmount), paymentReference: paymentReference || undefined, paymentDate: paymentDate || undefined } })}
              >
                {t('staffDeployments.paymentsDue.recordPaymentButton')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve/Reject one Pending payment. */}
      <Modal
        open={Boolean(decidingPayment)}
        onClose={() => {
          if (decideMutation.isPending) return;
          setDecidingPayment(null);
          setPayDecision(null);
        }}
        title={
          decidingPayment
            ? t(payDecision === 'Approved' ? 'staffDeployments.paymentsDue.approveModalTitle' : 'staffDeployments.paymentsDue.rejectModalTitle')
            : ''
        }
      >
        {decidingPayment && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('staffDeployments.paymentsDue.decideModalMessage', { amount: formatMoney(decidingPayment.amount) })}
            </p>
            <Textarea
              label={
                payDecision === 'Rejected'
                  ? t('staffDeployments.paymentsDue.decisionNoteRequiredLabel')
                  : t('staffDeployments.paymentsDue.decisionNoteOptionalLabel')
              }
              value={payDecisionNote}
              onChange={(e) => setPayDecisionNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDecidingPayment(null);
                  setPayDecision(null);
                }}
                disabled={decideMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={payDecision === 'Rejected' ? 'danger' : 'primary'}
                isLoading={decideMutation.isPending}
                disabled={payDecision === 'Rejected' && !payDecisionNote.trim()}
                onClick={() =>
                  decideMutation.mutate({
                    paymentId: decidingPayment._id,
                    values: { decision: payDecision, note: payDecisionNote.trim() || undefined },
                  })
                }
              >
                {payDecision === 'Approved' ? t('common.approve') : t('common.reject')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
