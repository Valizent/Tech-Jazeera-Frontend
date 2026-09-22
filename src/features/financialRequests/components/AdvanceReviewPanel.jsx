/**
 * AdvanceReviewPanel — the staff review queue for salary advance requests,
 * plus recording repayments against an approved one. No multi-level
 * approval matrix (see docs/P3-C-notes.md) — single-level Approve/Reject,
 * same as Leave.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAdvances, submitAdvance, decideAdvance, addAdvanceRepayment } from '../advances.api.js';
import {
  repaymentFormSchema,
  emptyRepaymentForm,
  advanceFormSchema,
  emptyAdvanceForm,
} from '../financialRequests.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import {
  ADVANCE_STATUSES,
  ADVANCE_STATUS_VARIANT,
  FINANCIAL_REQUEST_MONEY_ROLES,
} from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

/**
 * SubmitAdvancePanel — a STAFF member (Coordinator/HR/Manager/Accounts)
 * submitting their OWN advance request. Admin has no Employee record and
 * never sees this panel. Workers use MyRequestsPage instead; this reuses
 * the exact same form schema/fields.
 */
export function SubmitAdvancePanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(advanceFormSchema), defaultValues: emptyAdvanceForm });

  const submitMutation = useMutation({
    mutationFn: submitAdvance,
    onSuccess: () => {
      toast.success('Advance request submitted.');
      reset(emptyAdvanceForm);
      queryClient.invalidateQueries({ queryKey: ['financial-requests', 'advances'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Submit your own advance request</h2>
      <form onSubmit={handleSubmit((values) => submitMutation.mutate(values))} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Amount *" type="number" step="0.01" min="1" error={errors.amount?.message} {...register('amount')} />
          <Input
            label="Repay over (months) *"
            type="number"
            min="1"
            max="24"
            error={errors.repaymentMonths?.message}
            {...register('repaymentMonths')}
          />
        </div>
        <Textarea label="Reason" placeholder="Optional" error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            Submit request
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdvanceReviewPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canRecordRepayment = FINANCIAL_REQUEST_MONEY_ROLES.includes(user.role);
  const [status, setStatus] = useState('');
  const [repaying, setRepaying] = useState(null); // the advance being repaid, or null
  const [confirming, setConfirming] = useState(null); // { advance, decision } or null

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['financial-requests', 'advances', { status }],
    queryFn: () => listAdvances({ limit: 50, ...(status && { status }) }),
    // Same reasoning as the Leave review queue: a submission from another
    // session has no way to reach this already-open queue otherwise. 20s,
    // not 10s (2026-09-22, a real QA-audit finding — P1) — see
    // LeavePage.jsx's own comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['financial-requests', 'advances'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideAdvance(id, { status: decision }),
    onSuccess: (advance) => {
      toast.success(`Advance ${advance.status.toLowerCase()}.`);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(repaymentFormSchema), defaultValues: emptyRepaymentForm });

  const repayMutation = useMutation({
    mutationFn: ({ id, values }) => addAdvanceRepayment(id, values),
    onSuccess: (advance) => {
      toast.success(
        advance.status === 'Closed' ? 'Repayment recorded — advance fully repaid.' : 'Repayment recorded.'
      );
      setRepaying(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openRepay(advance) {
    reset(emptyRepaymentForm);
    setRepaying(advance);
  }

  return (
      <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Salary advances</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {ADVANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <EmptyState
          title="Could not load advances"
          description="Check your connection and try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title="No advance requests" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((a) => (
            <div key={a._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {a.employee?.fullName} <span className="font-normal text-muted">({a.employee?.employeeId})</span>
                </p>
                <p className="text-xs text-muted">
                  {formatMoney(a.amount)} · over {a.repaymentMonths} month{a.repaymentMonths > 1 ? 's' : ''} · requested{' '}
                  {formatDate(a.createdAt)}
                </p>
                {a.reason && <p className="mt-1 text-xs text-muted">{a.reason}</p>}
                {(a.status === 'Approved' || a.status === 'Closed') && (
                  <p className="mt-1 text-xs">
                    Repaid {formatMoney(a.amountRepaid)} of {formatMoney(a.amount)} — outstanding{' '}
                    <span className="font-semibold">{formatMoney(a.outstandingBalance)}</span>
                  </p>
                )}
                <ApprovalTrailView request={a} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={ADVANCE_STATUS_VARIANT[a.status]}>{a.status}</Badge>
                {a.canDecideCurrentStep && a.status === 'Pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirming({ advance: a, decision: 'Approved' })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ advance: a, decision: 'Rejected' })}>
                      Reject
                    </Button>
                  </div>
                )}
                {canRecordRepayment && a.status === 'Approved' && (
                  <Button size="sm" variant="ghost" onClick={() => openRepay(a)}>
                    Record repayment
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!repaying} onClose={() => setRepaying(null)} title="Record a repayment">
        {repaying && (
          <form
            onSubmit={handleSubmit((values) => repayMutation.mutate({ id: repaying._id, values }))}
            noValidate
            className="space-y-4"
          >
            <p className="text-sm text-muted">
              {repaying.employee?.fullName} — outstanding <span className="font-semibold text-text">{formatMoney(repaying.outstandingBalance)}</span>
            </p>
            <Input label="Amount *" type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
            <Input label="Date *" type="date" error={errors.date?.message} {...register('date')} />
            <Textarea label="Note" placeholder="Optional" error={errors.note?.message} {...register('note')} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRepaying(null)} disabled={repayMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={repayMutation.isPending}>
                Save repayment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.decision === 'Approved' ? 'Approve advance request?' : 'Reject advance request?'}
        message={
          confirming &&
          `${confirming.decision === 'Approved' ? 'Approve' : 'Reject'} ${confirming.advance.employee?.fullName}'s ${formatMoney(confirming.advance.amount)} advance request? This cannot be undone.`
        }
        confirmLabel={confirming?.decision === 'Approved' ? 'Approve' : 'Reject'}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.advance._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />
      </Card>
  );
}
