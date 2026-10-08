/**
 * PaymentsReviewPage — the manager's dedicated approval queue for recorded
 * payments. `side` picks the money flow (see financialSides.js): 'client'
 * is payments received from clients, 'subcontractor' (2026-10-08, the queue
 * had no page or route before: subcontractor payments could never be
 * approved, so never counted) is payments made to subcontractors. 2026-09-28: initial implementation. 2026-09-29: given
 * full i18n (a real audit finding — this shipped 100% hardcoded English,
 * a regression against the app's staff-panel Arabic convention every
 * sibling financial page already follows, including PaymentsDuePage.jsx
 * right next to it).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { FINANCIAL_SIDES } from '../financialSides.js';
import { apiMessage, formatMoney, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function PaymentsReviewPage({ side: sideName }) {
  const side = FINANCIAL_SIDES[sideName];
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [decidingRow, setDecidingRow] = useState(null); // { ...row, action: 'Approved' | 'Rejected' }
  const [note, setNote] = useState('');

  const canDecide = Boolean(user.sectionAccessWrite?.includes('deploymentsPaymentDecide'));

  const { data: rows, isPending, isError, refetch } = useQuery({
    queryKey: side.pendingKey,
    queryFn: side.getPending,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const decideMutation = useMutation({
    mutationFn: ({ paymentId, decision, note: n }) =>
      side.decidePayment(paymentId, { decision, note: n || undefined }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'Approved' ? t('staffDeployments.paymentsReview.approvedToast') : t('staffDeployments.paymentsReview.rejectedToast'));
      setDecidingRow(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['deployments'] });
    },
    onError: (err) => {
      console.error('[financial] deciding a payment failed', err);
      toast.error(apiMessage(err));
    },
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
          title={t('staffDeployments.paymentsReview.accessRestrictedTitle')}
          description={t('staffDeployments.paymentsReview.accessRestrictedDescription')}
          action={<Button variant="secondary" onClick={() => navigate(-1)}>{t('common.back')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t(side.reviewTitleKey)}
        description={t(side.reviewDescriptionKey)}
        onBack={() => navigate(-1)}
        actions={
          rows?.length > 0 && (
            <Badge variant="warning">{t('staffDeployments.paymentsReview.pendingBadge', { count: rows.length })}</Badge>
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
          title={t('staffDeployments.paymentsReview.loadFailedTitle')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-base font-semibold text-text">{t('staffDeployments.paymentsReview.allCaughtUpTitle')}</p>
            <p className="text-sm text-muted">{t('staffDeployments.paymentsReview.allCaughtUpDescription')}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row._id}
              className="group rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{side.pendingPartyName(row) || t(side.unknownPartyKey)}</span>
                    {row.paymentReference && (
                      <>
                        <span className="text-muted">·</span>
                        <span className="text-sm font-mono text-muted">{row.paymentReference}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="warning">{t('common.status.Pending')}</Badge>
                    <span className="text-xs font-medium text-muted">{t('staffDeployments.paymentsReview.recordedBy', { name: row.recordedBy?.name })}</span>
                    <span className="text-muted">·</span>
                    <span className="text-xs text-muted">{formatDate(row.paymentDate || row.recordedAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="me-4 text-lg font-semibold text-text">
                    {formatMoney(row.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openModal(row, 'Approved')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-success/10 px-3 text-xs font-semibold text-success transition-colors hover:bg-success/20"
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
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    {t('common.reject')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(decidingRow)}
        onClose={closeModal}
        title={
          decidingRow
            ? t(decidingRow.action === 'Approved' ? 'staffDeployments.paymentsReview.approveModalTitle' : 'staffDeployments.paymentsReview.rejectModalTitle')
            : ''
        }
      >
        {decidingRow && (
          <div className="space-y-4">
            <div className="rounded-xl bg-bg p-4">
              <p className="text-sm text-text">
                <span className="font-semibold">{side.pendingPartyName(decidingRow)}</span>
                <span className="mx-2 text-muted">·</span>
                <span className="tabular-nums">{formatMoney(decidingRow.amount)}</span>
              </p>
            </div>

            {decidingRow.action === 'Rejected' && (
              <p className="text-sm font-medium text-danger">{t('staffDeployments.paymentsReview.confirmReject')}</p>
            )}

            <Textarea
              label={decidingRow.action === 'Rejected' ? t('staffDeployments.paymentsReview.reasonRequiredLabel') : t('staffDeployments.paymentsReview.noteOptionalLabel')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('staffDeployments.paymentsReview.notePlaceholder')}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={decideMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={decidingRow.action === 'Rejected' ? 'danger' : 'primary'}
                isLoading={decideMutation.isPending}
                disabled={decidingRow.action === 'Rejected' && !note.trim()}
                onClick={() =>
                  decideMutation.mutate({
                    paymentId: decidingRow._id,
                    decision: decidingRow.action,
                    note: note.trim(),
                  })
                }
              >
                {decidingRow.action === 'Approved' ? t('common.approve') : t('common.reject')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
