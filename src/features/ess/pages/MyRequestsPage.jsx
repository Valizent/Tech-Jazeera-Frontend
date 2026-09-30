/**
 * MyRequestsPage — a Worker's salary advance and reimbursement requests
 * (P3-C). One page, two sections — mirrors how the staff-side
 * FinancialRequestsPage groups the same two concerns.
 */
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listMyAdvances,
  submitMyAdvance,
  cancelMyAdvance,
  listMyReimbursements,
  submitMyReimbursement,
  cancelMyReimbursement,
  downloadMyReceipt,
} from '../ess.api.js';
import {
  advanceFormSchema,
  emptyAdvanceForm,
  reimbursementFormSchema,
  emptyReimbursementForm,
} from '../../financialRequests/financialRequests.schema.js';
import { apiMessage, formatDate, formatMoney, collectFormErrorMessages } from '../../../lib/utils.js';
import {
  ADVANCE_STATUS_VARIANT,
  REIMBURSEMENT_CATEGORIES,
  REIMBURSEMENT_STATUS_VARIANT,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_MB,
} from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

function MyAdvancesSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'advances'],
    queryFn: () => listMyAdvances({ limit: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(advanceFormSchema), defaultValues: emptyAdvanceForm });

  const submitMutation = useMutation({
    mutationFn: submitMyAdvance,
    onSuccess: () => {
      toast.success(t('requests.advances.submittedToast'));
      reset(emptyAdvanceForm);
      queryClient.invalidateQueries({ queryKey: ['me', 'advances'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelMyAdvance(id),
    onSuccess: () => {
      toast.success(t('requests.advances.cancelledToast'));
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me', 'advances'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToCancel(null);
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[ess] advance form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('requests.advances.formInvalid'));
  };

  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('requests.advances.sectionTitle')}</h2>
        <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('requests.advances.amount')} type="number" step="0.01" min="1" error={errors.amount?.message} {...register('amount')} />
            <Input label={t('requests.advances.repaymentMonths')} type="number" min="1" max="24" error={errors.repaymentMonths?.message} {...register('repaymentMonths')} />
          </div>
          <Textarea label={t('requests.advances.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />
          <div className="flex justify-end">
            <Button type="submit" isLoading={submitMutation.isPending}>
              {t('common.submitRequest')}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('requests.advances.yourRequests')}</h2>
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <EmptyState
            title={t('requests.advances.loadError')}
            description={t('common.checkConnection')}
            action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : data.items.length === 0 ? (
          <EmptyState title={t('requests.advances.empty')} description={t('requests.advances.emptyDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {data.items.map((a) => (
              <div key={a._id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{formatMoney(a.amount)}</p>
                  <p className="text-xs text-muted">
                    {t('requests.advances.overMonths', { count: a.repaymentMonths })}
                    {t('requests.advances.requestedOn', { date: formatDate(a.createdAt) })}
                  </p>
                  {(a.status === 'Approved' || a.status === 'Closed') && (
                    <p className="mt-1 text-xs font-semibold">{t('requests.advances.outstanding', { amount: formatMoney(a.outstandingBalance) })}</p>
                  )}
                  {a.decisionNote && <p className="mt-1 text-xs italic text-muted">{t('common.note')}: {a.decisionNote}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={ADVANCE_STATUS_VARIANT[a.status]}>{t(`common.status.${a.status}`, a.status)}</Badge>
                  {a.status === 'Pending' && (
                    <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(a)}>
                      {t('leave.cancelButton')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('requests.advances.cancelDialog.title')}
        message={toCancel && t('requests.advances.cancelDialog.message', { amount: formatMoney(toCancel.amount) })}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}

function MyReimbursementsSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'reimbursements'],
    queryFn: () => listMyReimbursements({ limit: 50 }),
  });

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
      toast.error(t('requests.reimbursements.fileTooLarge', { maxMb: RECEIPT_MAX_MB }));
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
      return submitMyReimbursement(fd);
    },
    onSuccess: () => {
      toast.success(t('requests.reimbursements.submittedToast'));
      reset(emptyReimbursementForm);
      resetFile();
      queryClient.invalidateQueries({ queryKey: ['me', 'reimbursements'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelMyReimbursement(id),
    onSuccess: () => {
      toast.success(t('requests.reimbursements.cancelledToast'));
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me', 'reimbursements'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToCancel(null);
    },
  });

  function onSubmit(values) {
    if (!pendingFile) {
      toast.error(t('requests.reimbursements.attachReceiptFirst'));
      return;
    }
    submitMutation.mutate(values);
  }

  const onInvalid = (formErrors) => {
    console.error('[ess] reimbursement form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('requests.reimbursements.formInvalid'));
  };

  async function handleDownload(claim) {
    setDownloadingId(claim._id);
    try {
      await downloadMyReceipt(claim._id, claim.receipt.originalName);
    } catch (error) {
      toast.error(apiMessage(error, t('requests.reimbursements.receiptDownloadError')));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('requests.reimbursements.sectionTitle')}</h2>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label={t('requests.reimbursements.category')} error={errors.category?.message} {...register('category')}>
              <option value="">{t('requests.reimbursements.chooseCategory')}</option>
              {REIMBURSEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`requests.reimbursements.categories.${c}`, c)}
                </option>
              ))}
            </Select>
            <Input label={t('requests.reimbursements.amount')} type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
          </div>
          <Input label={t('requests.reimbursements.expenseDate')} type="date" error={errors.expenseDate?.message} {...register('expenseDate')} />
          <Textarea label={t('requests.reimbursements.description')} placeholder={t('common.optional')} error={errors.description?.message} {...register('description')} />

          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('requests.reimbursements.receipt')}</label>
            <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {pendingFile ? t('requests.reimbursements.changeFile') : t('requests.reimbursements.chooseFile')}
              </Button>
              {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">{t('requests.reimbursements.fileHint', { maxMb: RECEIPT_MAX_MB })}</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={submitMutation.isPending}>
              {t('requests.reimbursements.submitClaim')}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('requests.reimbursements.yourClaims')}</h2>
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <EmptyState
            title={t('requests.reimbursements.loadError')}
            description={t('common.checkConnection')}
            action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : data.items.length === 0 ? (
          <EmptyState title={t('requests.reimbursements.empty')} description={t('requests.reimbursements.emptyDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {data.items.map((c) => (
              <div key={c._id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t(`requests.reimbursements.categories.${c.category}`, c.category)} · {formatMoney(c.amount)}
                  </p>
                  <p className="text-xs text-muted">{t('requests.reimbursements.expenseOn', { date: formatDate(c.expenseDate) })}</p>
                  {c.decisionNote && <p className="mt-1 text-xs italic text-muted">{t('common.note')}: {c.decisionNote}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={REIMBURSEMENT_STATUS_VARIANT[c.status]}>{t(`common.status.${c.status}`, c.status)}</Badge>
                  <Button size="sm" variant="ghost" isLoading={downloadingId === c._id} onClick={() => handleDownload(c)}>
                    {t('requests.reimbursements.receiptButton')}
                  </Button>
                  {c.status === 'Pending' && (
                    <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(c)}>
                      {t('leave.cancelButton')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('requests.reimbursements.cancelDialog.title')}
        message={
          toCancel &&
          t('requests.reimbursements.cancelDialog.message', {
            category: t(`requests.reimbursements.categories.${toCancel.category}`, toCancel.category),
            amount: formatMoney(toCancel.amount),
          })
        }
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}

export default function MyRequestsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('requests.title')} description={t('requests.description')} />
      <MyAdvancesSection />
      <MyReimbursementsSection />
    </div>
  );
}
