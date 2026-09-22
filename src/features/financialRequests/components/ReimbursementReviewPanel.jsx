/**
 * ReimbursementReviewPanel — the staff review queue for expense
 * reimbursement claims: approve/reject, download the receipt, then mark
 * paid once Accounts has actually reimbursed it.
 */
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listReimbursements,
  submitReimbursement,
  decideReimbursement,
  markReimbursementPaid,
  downloadReceipt,
} from '../reimbursements.api.js';
import { reimbursementFormSchema, emptyReimbursementForm } from '../financialRequests.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import {
  REIMBURSEMENT_STATUSES,
  REIMBURSEMENT_STATUS_VARIANT,
  REIMBURSEMENT_CATEGORIES,
  FINANCIAL_REQUEST_MONEY_ROLES,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_MB,
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
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

/**
 * SubmitReimbursementPanel — a STAFF member (Coordinator/HR/Manager/
 * Accounts) submitting their OWN reimbursement claim. Admin has no Employee
 * record and never sees this panel. Workers use MyRequestsPage instead;
 * this reuses the exact same form schema/fields/file-upload pattern.
 */
export function SubmitReimbursementPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(reimbursementFormSchema), defaultValues: emptyReimbursementForm });

  function resetFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(`File is too large — max ${RECEIPT_MAX_MB}MB.`);
      e.target.value = '';
      return;
    }
    setPendingFile(file);
  }

  const submitMutation = useMutation({
    mutationFn: (values) => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) fd.append(key, value);
      fd.append('file', pendingFile);
      return submitReimbursement(fd);
    },
    onSuccess: () => {
      toast.success('Reimbursement claim submitted.');
      reset(emptyReimbursementForm);
      resetFile();
      queryClient.invalidateQueries({ queryKey: ['financial-requests', 'reimbursements'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function onSubmit(values) {
    if (!pendingFile) {
      toast.error('Attach a receipt first.');
      return;
    }
    submitMutation.mutate(values);
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Submit your own reimbursement claim</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Category *" error={errors.category?.message} {...register('category')}>
            <option value="">Choose a category…</option>
            {REIMBURSEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input label="Amount *" type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
        </div>
        <Input label="Expense date *" type="date" error={errors.expenseDate?.message} {...register('expenseDate')} />
        <Textarea label="Description" placeholder="Optional" error={errors.description?.message} {...register('description')} />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Receipt *</label>
          <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {pendingFile ? 'Change file' : 'Choose file'}
            </Button>
            {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
          </div>
          <p className="mt-1 text-xs text-muted">Max {RECEIPT_MAX_MB}MB.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            Submit claim
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ReimbursementReviewPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canPay = FINANCIAL_REQUEST_MONEY_ROLES.includes(user.role);
  const [status, setStatus] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [confirming, setConfirming] = useState(null); // { claim, decision } or null

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['financial-requests', 'reimbursements', { status }],
    queryFn: () => listReimbursements({ limit: 50, ...(status && { status }) }),
    // Same reasoning as the Leave review queue: a submission from another
    // session has no way to reach this already-open queue otherwise. 20s,
    // not 10s (2026-09-22, a real QA-audit finding — P1) — see
    // LeavePage.jsx's own comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['financial-requests', 'reimbursements'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideReimbursement(id, { status: decision }),
    onSuccess: (claim) => {
      toast.success(`Claim ${claim.status.toLowerCase()}.`);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const payMutation = useMutation({
    mutationFn: (id) => markReimbursementPaid(id),
    onSuccess: () => {
      toast.success('Claim marked paid.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function handleDownload(claim) {
    setDownloadingId(claim._id);
    try {
      await downloadReceipt(claim._id, claim.receipt.originalName);
    } catch (error) {
      toast.error(apiMessage(error, 'Could not download the receipt.'));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
      <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Reimbursement claims</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {REIMBURSEMENT_STATUSES.map((s) => (
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
          title="Could not load reimbursement claims"
          description="Check your connection and try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title="No reimbursement claims" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((c) => (
            <div key={c._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.employee?.fullName} <span className="font-normal text-muted">({c.employee?.employeeId})</span>
                </p>
                <p className="text-xs text-muted">
                  {c.category} · {formatMoney(c.amount)} · expense {formatDate(c.expenseDate)}
                </p>
                {c.description && <p className="mt-1 text-xs text-muted">{c.description}</p>}
                <ApprovalTrailView request={c} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={REIMBURSEMENT_STATUS_VARIANT[c.status]}>{c.status}</Badge>
                {/* Gated the same as the server's receipt route (no per-claim
                    ownership check exists there — see financialRequests.routes.js) */}
                {canPay && (
                  <Button size="sm" variant="ghost" isLoading={downloadingId === c._id} onClick={() => handleDownload(c)}>
                    Receipt
                  </Button>
                )}
                {c.canDecideCurrentStep && c.status === 'Pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirming({ claim: c, decision: 'Approved' })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ claim: c, decision: 'Rejected' })}>
                      Reject
                    </Button>
                  </div>
                )}
                {canPay && c.status === 'Approved' && (
                  <Button size="sm" variant="ghost" isLoading={payMutation.isPending} onClick={() => payMutation.mutate(c._id)}>
                    Mark paid
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.decision === 'Approved' ? 'Approve reimbursement claim?' : 'Reject reimbursement claim?'}
        message={
          confirming &&
          `${confirming.decision === 'Approved' ? 'Approve' : 'Reject'} ${confirming.claim.employee?.fullName}'s ${formatMoney(confirming.claim.amount)} ${confirming.claim.category} claim? This cannot be undone.`
        }
        confirmLabel={confirming?.decision === 'Approved' ? 'Approve' : 'Reject'}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.claim._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />
      </Card>
  );
}
