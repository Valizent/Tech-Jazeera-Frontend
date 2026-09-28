import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getPendingPaymentsQueue, decideClientPayment } from '../deployments.api.js';
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

export default function PaymentsReviewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [decidingRow, setDecidingRow] = useState(null); // { ...row, action: 'Approved' | 'Rejected' }
  const [note, setNote] = useState('');

  const canDecide = Boolean(user.sectionAccessWrite?.includes('deploymentsPaymentDecide'));

  const { data: rows, isPending, isError, refetch } = useQuery({
    queryKey: ['deployments', 'pending-payments'],
    queryFn: getPendingPaymentsQueue,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const decideMutation = useMutation({
    mutationFn: ({ paymentId, decision, note: n }) =>
      decideClientPayment(paymentId, { decision, note: n || undefined }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'Approved' ? 'Payment approved.' : 'Payment rejected.');
      setDecidingRow(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['deployments', 'pending-payments'] });
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
          title="Access restricted"
          description="You need the Payments Decide permission to access this page."
          action={<Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Payments Approval Queue"
        description="Recorded client payments awaiting your review."
        onBack={() => navigate(-1)}
        actions={
          rows?.length > 0 && (
            <Badge variant="warning">{rows.length} pending</Badge>
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
          title="Could not load the queue"
          description="Check your connection and try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-base font-semibold text-text">All caught up!</p>
            <p className="text-sm text-muted">No payments are waiting for your approval right now.</p>
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
                    <span className="text-sm font-semibold text-text">{row.client?.companyName || 'Unknown Client'}</span>
                    {row.paymentReference && (
                      <>
                        <span className="text-muted">·</span>
                        <span className="text-sm font-mono text-muted">{row.paymentReference}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="warning">Pending</Badge>
                    <span className="text-xs font-medium text-muted">Recorded by {row.recordedBy?.name}</span>
                    <span className="text-muted">·</span>
                    <span className="text-xs text-muted">{formatDate(row.paymentDate || row.recordedAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="mr-4 text-lg font-semibold text-text">
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
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal(row, 'Rejected')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger/10 px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    Reject
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
            ? decidingRow.action === 'Approved'
              ? 'Approve Payment'
              : 'Reject Payment'
            : ''
        }
      >
        {decidingRow && (
          <div className="space-y-4">
            <div className="rounded-xl bg-bg p-4">
              <p className="text-sm text-text">
                <span className="font-semibold">{decidingRow.client?.companyName}</span>
                <span className="mx-2 text-muted">—</span>
                <span className="tabular-nums">{formatMoney(decidingRow.amount)}</span>
              </p>
            </div>

            {decidingRow.action === 'Rejected' && (
              <p className="text-sm font-medium text-danger">Are you sure you want to reject this payment?</p>
            )}

            <Textarea
              label={decidingRow.action === 'Rejected' ? 'Reason for rejection (Required)' : 'Note (Optional)'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Needs correction..."
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={decideMutation.isPending}>
                Cancel
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
                {decidingRow.action}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
