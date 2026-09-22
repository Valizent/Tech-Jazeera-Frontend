/**
 * LeavePage — the staff side of the Leave module (P2-M2): policy config
 * (Admin/Manager) and the review queue (every staff role reads; Admin/
 * Manager/HR/Coordinator decide — Coordinator scoped to their own team by
 * the server). Workers use MyLeavePage (/me/leave) instead.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  listLeaveRequests,
  submitLeaveRequest,
  decideLeaveRequest,
  acknowledgeLeaveRequest,
  downloadLeaveAttachment,
} from '../leave.api.js';
import {
  leaveTypeFormSchema,
  emptyLeaveTypeForm,
  emptySickLeaveTypeForm,
  leaveTypeToForm,
  submitLeaveFormSchema,
  emptySubmitLeaveForm,
} from '../leave.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import {
  LEAVE_RECURRENCES,
  LEAVE_RECURRENCE_LABELS,
  LEAVE_REQUEST_STATUSES,
  LEAVE_REQUEST_STATUS_LABELS,
  LEAVE_STATUS_VARIANT,
  LEAVE_TYPE_MANAGE_ROLES,
  LEAVE_DECIDE_ROLES,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_MB,
} from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import UpcomingHolidays from '../../holidays/components/UpcomingHolidays.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';

function LeaveTypesPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit

  const { data: types, isPending } = useQuery({ queryKey: ['leave-types', {}], queryFn: () => listLeaveTypes() });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(leaveTypeFormSchema), defaultValues: emptyLeaveTypeForm });
  const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({ control, name: 'sickPayTiers' });
  const recurrence = watch('recurrence');

  // Switching a NEW leave type to 'Sick' pre-fills Article 117's statutory
  // tiers as a starting point (editable before saving) — only the tiers
  // field, so it never clobbers a name the user already typed. Only for a
  // brand new type; editing an existing one already loaded its own real
  // tiers via leaveTypeToForm(), so this must never fire for `editing?._id`.
  useEffect(() => {
    if (!editing || editing._id) return;
    if (recurrence === 'Sick' && tierFields.length === 0) {
      setValue('sickPayTiers', emptySickLeaveTypeForm.sickPayTiers);
    }
  }, [recurrence, editing, tierFields.length, setValue]);

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing?._id ? updateLeaveType(editing._id, values) : createLeaveType(values),
    onSuccess: () => {
      toast.success(editing?._id ? t('staffLeave.types.updatedSuccess') : t('staffLeave.types.createdSuccess'));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyLeaveTypeForm);
    setEditing({});
  }
  function openEdit(type) {
    reset(leaveTypeToForm(type));
    setEditing(type);
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffLeave.types.title')}</h2>
        <Button size="sm" onClick={openNew}>
          {t('staffLeave.types.addType')}
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : types.length === 0 ? (
        <EmptyState title={t('staffLeave.types.emptyTitle')} description={t('staffLeave.types.emptyDescription')} />
      ) : (
        <div className="divide-y divide-border">
          {types.map((lt) => (
            <button
              key={lt._id}
              onClick={() => openEdit(lt)}
              className="-mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-bg/60"
            >
              <div>
                <p className="font-medium">{lt.name}</p>
                <p className="text-xs text-muted">
                  {t(`staffLeave.recurrenceLabels.${lt.recurrence}`, LEAVE_RECURRENCE_LABELS[lt.recurrence])}
                  {lt.recurrence === 'Annual' &&
                    ` · ${t('staffLeave.types.daysPerYearSuffix', { days: lt.daysPerYear })}${
                      lt.tierYears ? t('staffLeave.types.tierAfterSuffix', { tierDays: lt.tierDaysPerYear, years: lt.tierYears }) : ''
                    }`}
                  {lt.recurrence === 'ContractCycle' &&
                    ` · ${t('staffLeave.types.daysPerCycleSuffix', { days: lt.daysPerCycle, years: lt.cycleYears })}`}
                  {lt.recurrence === 'Sick' &&
                    ` · ${t('staffLeave.types.sickDaysPerYearSuffix', {
                      days: (lt.sickPayTiers ?? []).reduce((sum, tier) => sum + tier.days, 0),
                      breakdown: (lt.sickPayTiers ?? [])
                        .map((tier) => t('staffLeave.types.sickTierBreakdownItem', { days: tier.days, percent: tier.payPercent }))
                        .join(', '),
                    })}`}
                  {lt.minServiceMonths > 0 && ` · ${t('staffLeave.types.minServiceSuffix', { months: lt.minServiceMonths })}`}
                  {lt.maxDaysPerRequest ? ` · ${t('staffLeave.types.cappedSuffix', { days: lt.maxDaysPerRequest })}` : ''}
                  {lt.recurrence !== 'Sick' && !lt.isPaid && ` · ${t('staffLeave.types.unpaidSuffix')}`}
                </p>
              </div>
              <Badge variant={lt.isActive ? 'success' : 'default'}>{lt.isActive ? t('staffLeave.types.active') : t('staffLeave.types.inactive')}</Badge>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? t('staffLeave.types.modalEditTitle') : t('staffLeave.types.modalNewTitle')}>
        <form
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
          noValidate
          className="space-y-4"
        >
          <Input label={t('staffLeave.types.form.name')} error={errors.name?.message} {...register('name')} />
          <Select label={t('staffLeave.types.form.recurrenceLabel')} error={errors.recurrence?.message} {...register('recurrence')}>
            {LEAVE_RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {t(`staffLeave.recurrenceLabels.${r}`, LEAVE_RECURRENCE_LABELS[r])}
              </option>
            ))}
          </Select>

          {recurrence === 'Annual' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t('staffLeave.types.form.daysPerYear')} type="number" min="0" error={errors.daysPerYear?.message} {...register('daysPerYear')} />
              <div />
              <Input label={t('staffLeave.types.form.tierYears')} type="number" min="1" error={errors.tierYears?.message} {...register('tierYears')} />
              <Input label={t('staffLeave.types.form.tierDaysPerYear')} type="number" min="0" error={errors.tierDaysPerYear?.message} {...register('tierDaysPerYear')} />
            </div>
          )}
          {recurrence === 'ContractCycle' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t('staffLeave.types.form.cycleYears')} type="number" min="1" error={errors.cycleYears?.message} {...register('cycleYears')} />
              <Input label={t('staffLeave.types.form.daysPerCycle')} type="number" min="0" error={errors.daysPerCycle?.message} {...register('daysPerCycle')} />
            </div>
          )}
          {recurrence === 'Sick' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">{t('staffLeave.types.form.payTiers')}</label>
                <Button type="button" size="sm" variant="secondary" onClick={() => appendTier({ days: '', payPercent: '' })}>
                  {t('staffLeave.types.form.addTier')}
                </Button>
              </div>
              <p className="mb-2 text-xs text-muted">
                {t('staffLeave.types.form.tierHint')}
              </p>
              <div className="space-y-2">
                {tierFields.map((field, i) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder={t('staffLeave.types.form.tierDaysPlaceholder')}
                      aria-label={t('staffLeave.types.form.tierDaysAriaLabel', { index: i + 1 })}
                      error={errors.sickPayTiers?.[i]?.days?.message}
                      {...register(`sickPayTiers.${i}.days`)}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder={t('staffLeave.types.form.tierPayPlaceholder')}
                      aria-label={t('staffLeave.types.form.tierPayAriaLabel', { index: i + 1 })}
                      error={errors.sickPayTiers?.[i]?.payPercent?.message}
                      {...register(`sickPayTiers.${i}.payPercent`)}
                    />
                    <Button type="button" size="sm" variant="danger-ghost" onClick={() => removeTier(i)} aria-label={t('staffLeave.types.form.removeTierAriaLabel')}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              {errors.sickPayTiers?.message && <p className="mt-1 text-sm text-danger">{errors.sickPayTiers.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('staffLeave.types.form.minServiceMonths')}
              type="number"
              min="0"
              error={errors.minServiceMonths?.message}
              {...register('minServiceMonths')}
            />
            <Input
              label={t('staffLeave.types.form.maxDaysPerRequest')}
              type="number"
              min="1"
              placeholder={t('staffLeave.types.form.maxDaysPlaceholder')}
              error={errors.maxDaysPerRequest?.message}
              {...register('maxDaysPerRequest')}
            />
          </div>

          {recurrence !== 'Sick' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isPaid')} />
              {t('staffLeave.types.form.paidLeave')}
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isActive')} />
            {t('staffLeave.types.form.activeHint')}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/**
 * SubmitLeavePanel — a STAFF member (Coordinator/HR/Manager/Accounts)
 * submitting their OWN leave request. Admin has no Employee record and
 * never sees this panel (see employee.model.js's doc comment — Admin is the
 * one login with no workforce presence). Workers use MyLeavePage instead;
 * this reuses the exact same form schema/fields.
 */
function SubmitLeavePanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  const { data: types, isError: typesError } = useQuery({
    queryKey: ['leave-types', { activeOnly: true }],
    queryFn: () => listLeaveTypes({ activeOnly: 'true' }),
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
      toast.error(t('staffLeave.submit.fileTooLarge', { maxMb: RECEIPT_MAX_MB }));
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
      return submitLeaveRequest(fd);
    },
    onSuccess: (request) => {
      toast.success(request.status === 'AutoApproved' ? t('staffLeave.submit.approvedToast') : t('staffLeave.submit.submittedToast'));
      reset(emptySubmitLeaveForm);
      resetFile();
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffLeave.submit.title')}</h2>
      <form onSubmit={handleSubmit((values) => submitMutation.mutate(values))} noValidate className="space-y-4">
        <PickerLoadWarning failed={[{ label: 'leave types', isError: typesError }]} />
        <Select label={t('staffLeave.submit.chooseType')} error={errors.leaveType?.message} {...register('leaveType')}>
          <option value="">{t('staffLeave.submit.choosePlaceholder')}</option>
          {(types ?? []).map((ty) => (
            <option key={ty._id} value={ty._id}>
              {ty.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffLeave.submit.startDate')} type="date" error={errors.startDate?.message} {...register('startDate')} />
          <Input label={t('staffLeave.submit.endDate')} type="date" error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <Textarea label={t('staffLeave.submit.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('staffLeave.submit.attachment')}</label>
          <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {pendingFile ? t('staffLeave.submit.changeFile') : t('staffLeave.submit.chooseFile')}
            </Button>
            {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
          </div>
          <p className="mt-1 text-xs text-muted">{t('staffLeave.submit.fileHint', { maxMb: RECEIPT_MAX_MB })}</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReviewQueue() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canAcknowledge = LEAVE_DECIDE_ROLES.includes(user.role);
  const [status, setStatus] = useState('');
  // { req, decision } while the "are you sure?" dialog is open — a stray
  // click on Approve/Reject shouldn't be able to decide anything by itself.
  const [confirming, setConfirming] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['leave', { status }],
    queryFn: () => listLeaveRequests({ limit: 50, ...(status && { status }) }),
    // A new submission from another session (or another approver deciding a
    // step) has no way to reach this already-open queue otherwise — the
    // app-wide default is a 30s staleTime with no polling and no
    // refetch-on-focus. FIX (2026-09-22, a real QA-audit finding — P1): this
    // used to be 10s, "same cadence as NotificationBell's own poll" — but
    // this is a real paginated query against the model, not the bell's own
    // now much cheaper single count. 20s roughly halves this page's
    // contribution to request volume (the same change applied to every
    // sibling review queue — see the other refetchInterval sites this
    // comment is referenced from) while staying close enough to the bell's
    // own signal that a request still feels like it "arrived" within
    // moments, not stale.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leave'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideLeaveRequest(id, { status: decision }),
    onSuccess: (req) => {
      toast.success(req.status === 'Approved' ? t('staffLeave.queue.approvedDecidedToast') : t('staffLeave.queue.rejectedDecidedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const ackMutation = useMutation({
    mutationFn: (id) => acknowledgeLeaveRequest(id),
    onSuccess: () => {
      toast.success(t('staffLeave.queue.seenToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const [downloadingId, setDownloadingId] = useState(null);
  async function handleDownload(req) {
    setDownloadingId(req._id);
    try {
      await downloadLeaveAttachment(req._id, req.attachment.originalName);
    } catch (error) {
      toast.error(apiMessage(error, t('staffLeave.queue.attachmentDownloadError')));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffLeave.queue.title')}</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[200px]" aria-label={t('staffLeave.queue.filterAriaLabel')}>
          <option value="">{t('common.allStatuses')}</option>
          {LEAVE_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`staffLeave.statusLabels.${s}`, LEAVE_REQUEST_STATUS_LABELS[s])}
            </option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <EmptyState
          title={t('staffLeave.queue.couldNotLoad')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title={t('staffLeave.queue.emptyTitle')} description={t('staffLeave.queue.emptyDescription')} />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((req) => {
            const needsAck = req.status === 'AutoApproved' && !req.acknowledgedByManager;
            return (
              <div key={req._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {req.employee?.fullName}{' '}
                    <span className="font-normal text-muted">({req.employee?.employeeId})</span>
                  </p>
                  <p className="text-xs text-muted">
                    {req.leaveTypeName} · {formatDate(req.startDate)} – {formatDate(req.endDate)} ·{' '}
                    {t('staffLeave.queue.dayCount', { count: req.days })}
                  </p>
                  <p className="mt-1 text-xs text-muted">{req.eligibility?.ruleApplied}</p>
                  <ApprovalTrailView request={req} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={LEAVE_STATUS_VARIANT[req.status]}>{t(`staffLeave.statusLabels.${req.status}`, LEAVE_REQUEST_STATUS_LABELS[req.status])}</Badge>
                  {req.attachment && (
                    <Button size="sm" variant="ghost" isLoading={downloadingId === req._id} onClick={() => handleDownload(req)}>
                      {t('staffLeave.queue.viewAttachment')}
                    </Button>
                  )}
                  {req.canDecideCurrentStep && req.status === 'PendingReview' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setConfirming({ req, decision: 'Approved' })}>
                        {t('staffLeave.queue.approve')}
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ req, decision: 'Rejected' })}>
                        {t('staffLeave.queue.reject')}
                      </Button>
                    </div>
                  )}
                  {canAcknowledge && needsAck && (
                    <Button size="sm" variant="ghost" isLoading={ackMutation.isPending} onClick={() => ackMutation.mutate(req._id)}>
                      {t('staffLeave.queue.markSeen')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.decision === 'Approved' ? t('staffLeave.queue.approveTitle') : t('staffLeave.queue.rejectTitle')}
        message={
          confirming &&
          t('staffLeave.queue.confirmMessage', {
            action: confirming.decision === 'Approved' ? t('staffLeave.queue.approve') : t('staffLeave.queue.reject'),
            name: confirming.req.employee?.fullName,
            type: confirming.req.leaveTypeName,
            start: formatDate(confirming.req.startDate),
            end: formatDate(confirming.req.endDate),
          })
        }
        confirmLabel={confirming?.decision === 'Approved' ? t('staffLeave.queue.approve') : t('staffLeave.queue.reject')}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.req._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}

export default function LeavePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManageTypes = LEAVE_TYPE_MANAGE_ROLES.includes(user.role);

  const tabs = [
    { key: 'requests', label: t('staffLeave.tabs.requests'), content: <ReviewQueue /> },
    user.role !== 'Admin' && { key: 'submit', label: t('staffLeave.tabs.submit'), content: <SubmitLeavePanel /> },
    { key: 'holidays', label: t('staffLeave.tabs.holidays'), content: <UpcomingHolidays /> },
    canManageTypes && { key: 'types', label: t('staffLeave.tabs.types'), content: <LeaveTypesPanel /> },
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useTabParam(tabs, 'requests');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('staffLeave.page.title')}
        onBack={() => navigate(-1)}
        description={
          user.role === 'Coordinator'
            ? t('staffLeave.page.descriptionCoordinator')
            : t('staffLeave.page.descriptionDefault')
        }
      />
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
