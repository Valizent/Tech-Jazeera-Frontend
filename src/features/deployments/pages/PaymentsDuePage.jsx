/**
 * PaymentsDuePage (2026-09-27, the user's own ask) — every invoiced-but-not-
 * yet-fully-paid month, soonest-due first. A Coordinator sees only
 * mobilisations they're on; anyone with 'mobilisationsViewer' (this
 * company's real MM already holds it, plus Admin) sees everything — see
 * deployment.service.js's getPaymentsDue for the exact visibility rule.
 * No dedicated Section Access gate on the route itself: the data is already
 * correctly scoped server-side, so an ungranted viewer just sees an empty
 * list, same reasoning MobilisationDetailPage's own worker-history page
 * gives for skipping a Section Access key on a narrowly-scoped page.
 *
 * Gained real actions 2026-09-27 (moved here from the Deployment detail
 * page, the user's own ask — "financial should be for accountants and FM"):
 * Record Payment (Office Secretary / `deploymentsHours`) and Approve/Reject
 * (`deploymentsPaymentDecide`, the Financial Manager). The Deployment detail
 * page keeps a read-only status readout only.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPaymentsDue, recordPayment, decidePayment } from '../deployments.api.js';
import { formatDate, formatMoney, apiMessage } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
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

  // Same gates DeploymentDetailPage.jsx used before this moved here.
  const canRecordPayment = user.role === 'Office Secretary' || Boolean(user.sectionAccessWrite?.includes('deploymentsHours'));
  const canDecidePayment = Boolean(user.sectionAccessWrite?.includes('deploymentsPaymentDecide'));

  const [payingEntry, setPayingEntry] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payDecidingEntry, setPayDecidingEntry] = useState(null);
  const [payDecision, setPayDecision] = useState(null); // 'Approved' | 'Rejected'
  const [payDecisionNote, setPayDecisionNote] = useState('');

  const { data = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'payments-due'],
    queryFn: getPaymentsDue,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deployments', 'payments-due'] });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ deploymentId, entryId, values }) => recordPayment(deploymentId, entryId, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.paymentRecordedToast'));
      setPayingEntry(null);
      setPaymentAmount('');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const decidePaymentMutation = useMutation({
    mutationFn: ({ deploymentId, entryId, values }) => decidePayment(deploymentId, entryId, values),
    onSuccess: () => {
      toast.success(
        payDecision === 'Approved' ? t('staffDeployments.detail.paymentApprovedToast') : t('staffDeployments.detail.paymentRejectedToast')
      );
      setPayDecidingEntry(null);
      setPayDecision(null);
      setPayDecisionNote('');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    {
      key: 'worker',
      header: t('staffDeployments.paymentsDue.columns.worker'),
      render: (row) => (
        <span className="font-medium text-text">
          {row.workerName}
          <span className="block text-xs font-normal text-muted">{row.clientName}</span>
        </span>
      ),
    },
    { key: 'month', header: t('staffDeployments.paymentsDue.columns.month'), render: (row) => row.month },
    {
      key: 'invoice',
      header: t('staffDeployments.paymentsDue.columns.invoice'),
      render: (row) => (
        <span>
          {row.invoiceNumber ?? '—'}
          {row.invoiceDate && <span className="block text-xs text-muted">{formatDate(row.invoiceDate)}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('staffDeployments.paymentsDue.columns.amount'),
      render: (row) => (row.amountReceived > 0 ? formatMoney(row.amountReceived) : '—'),
    },
    {
      key: 'status',
      header: t('staffDeployments.paymentsDue.columns.status'),
      render: (row) =>
        row.paymentDecisionStatus === 'Pending' ? (
          <Badge variant="warning">{t('staffDeployments.paymentsDue.statusPending')}</Badge>
        ) : row.paymentDecisionStatus === 'Rejected' ? (
          <Badge variant="danger">{t('staffDeployments.paymentsDue.statusRejected')}</Badge>
        ) : (
          <Badge variant="default">{t('staffDeployments.paymentsDue.statusAwaiting')}</Badge>
        ),
    },
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

  if (canRecordPayment || canDecidePayment) {
    columns.push({
      key: 'action',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {canRecordPayment && row.paymentDecisionStatus !== 'Pending' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setPayingEntry(row);
                setPaymentAmount(row.amountReceived ? String(row.amountReceived) : '');
              }}
            >
              {t('staffDeployments.detail.recordPaymentButton')}
            </Button>
          )}
          {canDecidePayment && row.paymentDecisionStatus === 'Pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setPayDecidingEntry(row);
                  setPayDecision('Approved');
                  setPayDecisionNote('');
                }}
              >
                {t('common.approve')}
              </Button>
              <Button
                size="sm"
                variant="danger-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setPayDecidingEntry(row);
                  setPayDecision('Rejected');
                  setPayDecisionNote('');
                }}
              >
                {t('common.reject')}
              </Button>
            </>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.paymentsDue.pageTitle')}
        description={t('staffDeployments.paymentsDue.pageDescription')}
        onBack={() => navigate(-1)}
      />

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
            rows={data}
            rowKey={(row) => `${row.deploymentId}-${row.entryId}`}
            onRowClick={(row) => navigate(`/deployments/${row.deploymentId}`)}
            emptyState={
              <EmptyState
                title={t('staffDeployments.paymentsDue.emptyTitle')}
                description={t('staffDeployments.paymentsDue.emptyDescription')}
              />
            }
          />
        </Card>
      )}

      <Modal
        open={Boolean(payingEntry)}
        onClose={() => {
          if (recordPaymentMutation.isPending) return;
          setPayingEntry(null);
          setPaymentAmount('');
        }}
        title={payingEntry ? t('staffDeployments.detail.recordPaymentModalTitle', { month: payingEntry.month }) : ''}
      >
        {payingEntry && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('staffDeployments.detail.recordPaymentModalMessage')}</p>
            <Input
              label={t('staffDeployments.detail.amountReceivedLabel')}
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setPayingEntry(null)} disabled={recordPaymentMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                isLoading={recordPaymentMutation.isPending}
                disabled={paymentAmount === '' || Number(paymentAmount) < 0}
                onClick={() =>
                  recordPaymentMutation.mutate({
                    deploymentId: payingEntry.deploymentId,
                    entryId: payingEntry.entryId,
                    values: { amountReceived: Number(paymentAmount) },
                  })
                }
              >
                {t('staffDeployments.detail.recordPaymentButton')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(payDecidingEntry)}
        onClose={() => {
          if (decidePaymentMutation.isPending) return;
          setPayDecidingEntry(null);
          setPayDecision(null);
        }}
        title={
          payDecidingEntry
            ? t(
                payDecision === 'Approved' ? 'staffDeployments.detail.approvePaymentModalTitle' : 'staffDeployments.detail.rejectPaymentModalTitle',
                { month: payDecidingEntry.month }
              )
            : ''
        }
      >
        {payDecidingEntry && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('staffDeployments.detail.decidePaymentModalMessage', {
                amount: formatMoney(payDecidingEntry.amountReceived),
                worker: payDecidingEntry.workerName,
              })}
            </p>
            <Textarea
              label={
                payDecision === 'Rejected'
                  ? t('staffDeployments.detail.decisionNoteRequiredLabel')
                  : t('staffDeployments.detail.decisionNoteOptionalLabel')
              }
              value={payDecisionNote}
              onChange={(e) => setPayDecisionNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPayDecidingEntry(null);
                  setPayDecision(null);
                }}
                disabled={decidePaymentMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={payDecision === 'Rejected' ? 'danger' : 'primary'}
                isLoading={decidePaymentMutation.isPending}
                disabled={payDecision === 'Rejected' && !payDecisionNote.trim()}
                onClick={() =>
                  decidePaymentMutation.mutate({
                    deploymentId: payDecidingEntry.deploymentId,
                    entryId: payDecidingEntry.entryId,
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
