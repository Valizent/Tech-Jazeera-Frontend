/**
 * ExitReentryReviewPanel — the staff review queue for Exit Re-Entry visa
 * requests: approve/reject (per-row canDecideCurrentStep, via the
 * Configurable Approval Hierarchy engine — same as Leave), then mark issued
 * once HR has actually processed it with Jawazat/Muqeem (an external
 * process this app can't perform — see exitReentry.model.js). Marking
 * issued stays a separate, static-role check (EXIT_DOCUMENTS_ISSUE_ROLES) —
 * an HR/compliance recording step, not part of the approval chain.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listExitReentry, decideExitReentry, markExitReentryIssued } from '../exitReentry.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { EXIT_REENTRY_STATUSES, EXIT_REENTRY_STATUS_VARIANT, EXIT_DOCUMENTS_ISSUE_ROLES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function ExitReentryReviewPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canIssue = EXIT_DOCUMENTS_ISSUE_ROLES.includes(user.role);
  const [status, setStatus] = useState('');
  const [issuing, setIssuing] = useState(null);
  // { req, decision } while the "are you sure?" dialog is open.
  const [confirming, setConfirming] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['exit-documents', 'exit-reentry', { status }],
    queryFn: () => listExitReentry({ limit: 50, ...(status && { status }) }),
    // Same reasoning as the Leave review queue: a submission from another
    // session has no way to reach this already-open queue otherwise. 20s,
    // not 10s (2026-09-22, a real QA-audit finding — P1) — see
    // LeavePage.jsx's own comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exit-documents', 'exit-reentry'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideExitReentry(id, { status: decision }),
    onSuccess: (request) => {
      toast.success(`Request ${request.status.toLowerCase()}.`);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const { register, handleSubmit, reset } = useForm({ defaultValues: { visaReferenceNumber: '' } });
  const issueMutation = useMutation({
    mutationFn: ({ id, values }) => markExitReentryIssued(id, values),
    onSuccess: () => {
      toast.success('Marked as issued.');
      setIssuing(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openIssue(request) {
    reset({ visaReferenceNumber: '' });
    setIssuing(request);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Exit re-entry visas</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {EXIT_REENTRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <EmptyState title="Could not load requests" description="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No exit re-entry requests" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((r) => (
            <div key={r._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.employee?.fullName} <span className="font-normal text-muted">({r.employee?.employeeId})</span>
                </p>
                <p className="text-xs text-muted">
                  {r.visaType} exit · depart {formatDate(r.departureDate)} · return by {formatDate(r.expectedReturnDate)}
                </p>
                {r.reason && <p className="mt-1 text-xs text-muted">{r.reason}</p>}
                {r.visaReferenceNumber && <p className="mt-1 text-xs text-muted">Ref: {r.visaReferenceNumber}</p>}
                <ApprovalTrailView request={r} pendingStatus="Pending" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={EXIT_REENTRY_STATUS_VARIANT[r.status]}>{r.status}</Badge>
                {r.canDecideCurrentStep && r.status === 'Pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirming({ req: r, decision: 'Approved' })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ req: r, decision: 'Rejected' })}>
                      Reject
                    </Button>
                  </div>
                )}
                {canIssue && r.status === 'Approved' && (
                  <Button size="sm" variant="ghost" onClick={() => openIssue(r)}>
                    Mark issued
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.decision === 'Approved' ? 'Approve exit re-entry request?' : 'Reject exit re-entry request?'}
        message={
          confirming &&
          `${confirming.decision === 'Approved' ? 'Approve' : 'Reject'} ${confirming.req.employee?.fullName}'s ${confirming.req.visaType} exit re-entry request? This cannot be undone.`
        }
        confirmLabel={confirming?.decision === 'Approved' ? 'Approve' : 'Reject'}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.req._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />

      <Modal open={!!issuing} onClose={() => setIssuing(null)} title="Mark visa issued">
        <form onSubmit={handleSubmit((values) => issueMutation.mutate({ id: issuing._id, values }))} noValidate className="space-y-4">
          <p className="text-sm text-muted">Record this once processed with Jawazat/Muqeem.</p>
          <Input label="Visa reference number" placeholder="Optional" {...register('visaReferenceNumber')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIssuing(null)} disabled={issueMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={issueMutation.isPending}>
              Mark issued
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
