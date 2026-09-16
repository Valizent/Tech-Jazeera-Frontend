/**
 * MyLeavePage — a Worker submits leave requests and sees their own history
 * (P2-M2). Eligibility is never computed here: the server evaluates it at
 * submission time from the real joining date and leave history, and returns
 * the result (AutoApproved / PendingReview + why) — this page only displays it.
 */
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listMyLeave, submitMyLeave, cancelMyLeave, downloadMyLeaveAttachment } from '../ess.api.js';
import { listLeaveTypes } from '../../leave/leave.api.js';
import { submitLeaveFormSchema, emptySubmitLeaveForm } from '../../leave/leave.schema.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { LEAVE_STATUS_VARIANT, RECEIPT_ACCEPT, RECEIPT_MAX_MB } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import UpcomingHolidays from '../../holidays/components/UpcomingHolidays.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

export default function MyLeavePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data: types, isError: typesError } = useQuery({
    queryKey: ['leave-types', { activeOnly: true }],
    queryFn: () => listLeaveTypes({ activeOnly: 'true' }),
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'leave'],
    queryFn: () => listMyLeave({ limit: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(submitLeaveFormSchema), defaultValues: emptySubmitLeaveForm });

  function resetFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(t('leave.fileTooLarge', { maxMb: RECEIPT_MAX_MB }));
      e.target.value = '';
      return;
    }
    setPendingFile(file);
  }

  const submitMutation = useMutation({
    mutationFn: (values) => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) fd.append(key, value);
      if (pendingFile) fd.append('file', pendingFile);
      return submitMyLeave(fd);
    },
    onSuccess: (request) => {
      toast[request.status === 'AutoApproved' ? 'success' : 'info'](
        request.status === 'AutoApproved' ? t('leave.autoApprovedToast') : t('leave.submittedToast')
      );
      reset(emptySubmitLeaveForm);
      resetFile();
      queryClient.invalidateQueries({ queryKey: ['me', 'leave'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function handleDownload(req) {
    setDownloadingId(req._id);
    try {
      await downloadMyLeaveAttachment(req._id, req.attachment.originalName);
    } catch (error) {
      toast.error(apiMessage(error, t('leave.attachmentDownloadError')));
    } finally {
      setDownloadingId(null);
    }
  }

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelMyLeave(id),
    onSuccess: () => {
      toast.success(t('leave.cancelledToast'));
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me', 'leave'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToCancel(null);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('leave.title')} description={t('leave.description')} />

      <UpcomingHolidays />

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('leave.requestLeave')}</h2>
        <form
          onSubmit={handleSubmit((values) => submitMutation.mutate(values))}
          noValidate
          className="space-y-4"
        >
          <PickerLoadWarning failed={[{ label: 'leave types', isError: typesError }]} />
          <Select label={t('leave.leaveType')} error={errors.leaveType?.message} {...register('leaveType')}>
            <option value="">{t('leave.chooseLeaveType')}</option>
            {(types ?? []).map((ty) => (
              <option key={ty._id} value={ty._id}>
                {ty.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('leave.startDate')} type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Input label={t('leave.endDate')} type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
          <Textarea label={t('leave.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />

          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('leave.attachment')}</label>
            <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {pendingFile ? t('leave.changeFile') : t('leave.chooseFile')}
              </Button>
              {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">{t('leave.fileHint', { maxMb: RECEIPT_MAX_MB })}</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={submitMutation.isPending}>
              {t('common.submitRequest')}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('leave.yourRequests')}</h2>
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title={t('leave.loadError')}
            description={t('common.checkConnection')}
            action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : data.items.length === 0 ? (
          <EmptyState title={t('leave.empty')} description={t('leave.emptyDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {data.items.map((req) => {
              const cancellable =
                ['PendingReview', 'AutoApproved'].includes(req.status) && new Date(req.startDate) > new Date();
              return (
                <div key={req._id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {req.leaveTypeName} · {t('leave.days', { count: req.days })}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(req.startDate)} – {formatDate(req.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted">{req.eligibility?.ruleApplied}</p>
                    {req.decisionNote && (
                      <p className="mt-1 text-xs italic text-muted">{t('common.note')}: {req.decisionNote}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={LEAVE_STATUS_VARIANT[req.status]}>{t(`common.status.${req.status}`, req.status)}</Badge>
                    {req.attachment && (
                      <Button size="sm" variant="ghost" isLoading={downloadingId === req._id} onClick={() => handleDownload(req)}>
                        {t('leave.viewAttachment')}
                      </Button>
                    )}
                    {cancellable && (
                      <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(req)}>
                        {t('leave.cancelButton')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('leave.cancelDialog.title')}
        message={toCancel && t('leave.cancelDialog.message', { type: toCancel.leaveTypeName, days: toCancel.days })}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </div>
  );
}
