/**
 * DeploymentDetailPage — the workhorse: placement info, the monthly
 * client-hours/OT ledger (add + correct), and Release. This is the ONLY
 * place a deployment is managed — there is no separate create/edit page,
 * a Deployment is born automatically once its source Mobilisation is
 * Approved (see the Mobilisations module).
 */
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDeployment, addMonthlyHours, updateMonthlyHours, releaseDeployment } from '../deployments.api.js';
import {
  monthlyHoursFormSchema,
  emptyMonthlyHoursForm,
  monthlyHoursEntryToForm,
  releaseFormSchema,
  emptyReleaseForm,
} from '../deployments.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function monthStrOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function addMonthsToStr(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthStrOf(d);
}
function previousMonthStr() {
  return addMonthsToStr(monthStrOf(new Date()), -1);
}

/** The earliest eligible month not yet entered — a sensible default for the
 *  add-hours form, empty string when nothing is eligible yet (deployment
 *  started this calendar month). */
function nextEligibleMonth(deployment) {
  const start = monthStrOf(deployment.startDate);
  const maxEligible = previousMonthStr();
  if (start > maxEligible) return '';
  const entered = new Set(deployment.monthlyHours.map((m) => m.month));
  let candidate = start;
  while (candidate <= maxEligible) {
    if (!entered.has(candidate)) return candidate;
    candidate = addMonthsToStr(candidate, 1);
  }
  return '';
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{children || '—'}</span>
    </div>
  );
}

function MonthlyHoursForm({ deployment, defaultValues, onSubmit, submitting, submitLabel, monthFixed }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(monthlyHoursFormSchema), defaultValues });
  const start = monthStrOf(deployment.startDate);
  const max = previousMonthStr();

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('staffDeployments.detail.monthLabel')}
          type="month"
          min={start}
          max={max}
          disabled={monthFixed}
          error={errors.month?.message}
          {...register('month')}
        />
        <Input
          label={t('staffDeployments.detail.actualHoursLabel')}
          type="number"
          step="0.01"
          min="0"
          error={errors.actualHours?.message}
          {...register('actualHours')}
        />
        <Input
          label={t('staffDeployments.detail.otAmountLabel')}
          type="number"
          step="0.01"
          min="0"
          placeholder={t('staffDeployments.detail.otAmountPlaceholder')}
          error={errors.otAmount?.message}
          {...register('otAmount')}
        />
      </div>
      <Textarea label={t('staffDeployments.detail.notesLabel')} error={errors.notes?.message} {...register('notes')} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function DeploymentDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [releasing, setReleasing] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Office Secretary is a hardcoded exception to the Section Access gate —
  // mirrors deployment.service.js's addMonthlyHours exactly (they aren't a
  // grantable Section Access role at all).
  const canEnterHours = user.role === 'Office Secretary' || Boolean(user.sectionAccess?.includes('deploymentsHours'));
  const canRelease = Boolean(user.sectionAccess?.includes('deploymentsRelease'));

  const { data: deployment, isPending, isError } = useQuery({
    queryKey: ['deployment', id],
    queryFn: () => getDeployment(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deployment', id] });
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
  };

  const addMutation = useMutation({
    mutationFn: (values) => addMonthlyHours(id, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.addedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ entryId, values }) => updateMonthlyHours(id, entryId, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.updatedToast'));
      setEditingEntry(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const releaseMutation = useMutation({
    mutationFn: (values) => releaseDeployment(id, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.releasedToast', { name: deployment.workerName }));
      setReleasing(false);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const addDefaultValues = useMemo(() => {
    if (!deployment) return emptyMonthlyHoursForm;
    return { ...emptyMonthlyHoursForm, month: nextEligibleMonth(deployment) };
  }, [deployment]);

  const {
    register: registerRelease,
    handleSubmit: handleReleaseSubmit,
    formState: { errors: releaseErrors },
  } = useForm({ resolver: zodResolver(releaseFormSchema), defaultValues: emptyReleaseForm });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !deployment) {
    return (
      <EmptyState
        title={t('staffDeployments.detail.notFoundTitle')}
        description={t('staffDeployments.detail.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/deployments')} />}
      />
    );
  }

  const isActive = deployment.status === 'Active';
  const canAddThisMonth = isActive && canEnterHours && Boolean(nextEligibleMonth(deployment));
  const sortedMonths = [...deployment.monthlyHours].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`${deployment.workerName} — ${deployment.clientName}`}
        description={deployment.site}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? 'success' : 'default'}>{t(`common.status.${deployment.status}`, deployment.status)}</Badge>
            {isActive && canRelease && (
              <Button size="sm" variant="danger-ghost" onClick={() => setReleasing(true)}>
                {t('staffDeployments.detail.release')}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.sectionPlacement')}</h2>
        <DetailRow label={t('staffDeployments.detail.fields.worker')}>
          {deployment.worker?._id ? (
            <Link to={`/employees/${deployment.worker._id}`} className="text-primary hover:underline">
              {deployment.workerName}
            </Link>
          ) : (
            deployment.workerName
          )}
        </DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.workerType')}>
          {t(`staffMobilisations.form.workerType.${deployment.workerType}`, deployment.workerType)}
        </DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.client')}>
          <Link to={`/clients/${deployment.client}`} className="text-primary hover:underline">
            {deployment.clientName}
          </Link>
        </DetailRow>
        {deployment.site && <DetailRow label={t('staffDeployments.detail.fields.site')}>{deployment.site}</DetailRow>}
        {deployment.subcontractorName && (
          <DetailRow label={t('staffDeployments.detail.fields.subcontractor')}>{deployment.subcontractorName}</DetailRow>
        )}
        <DetailRow label={t('staffDeployments.detail.fields.contractHours')}>{deployment.requiredTimesheetHours ?? '—'}</DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.since')}>{formatDate(deployment.startDate)}</DetailRow>
        {!isActive && <DetailRow label={t('staffDeployments.detail.fields.released')}>{formatDate(deployment.endDate)}</DetailRow>}
        {deployment.releaseNote && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffDeployments.detail.notesLabel')}</p>
            <p className="text-sm">{deployment.releaseNote}</p>
          </div>
        )}
        {deployment.mobilisation && (
          <div className="mt-4">
            <Link to={`/mobilisations/${deployment.mobilisation._id}`} className="text-sm font-medium text-primary hover:underline">
              {t('staffDeployments.detail.viewMobilisation')} (#{deployment.mobilisation.serialNumber})
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.sectionMonthlyHours')}</h2>
        <p className="mb-4 text-sm text-muted">{t('staffDeployments.detail.monthlyHoursHint')}</p>

        {sortedMonths.length === 0 ? (
          <p className="mb-4 text-sm text-muted">{t('staffDeployments.detail.noMonthlyHours')}</p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/40 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.month')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.contractHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.actualHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.otHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.otAmount')}</th>
                  {canEnterHours && isActive && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedMonths.map((entry) => (
                  <tr key={entry._id}>
                    <td className="px-3 py-2 font-medium">{entry.month}</td>
                    <td className="px-3 py-2">{entry.contractHours}</td>
                    <td className="px-3 py-2">{entry.actualHours}</td>
                    <td className="px-3 py-2">{entry.otHours}</td>
                    <td className="px-3 py-2">{formatMoney(entry.otAmount)}</td>
                    {canEnterHours && isActive && (
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)}>
                          {t('staffDeployments.detail.editEntry')}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isActive ? (
          <p className="text-sm text-muted">{t('staffDeployments.detail.endedNote')}</p>
        ) : !canEnterHours ? null : canAddThisMonth ? (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.addMonthLabel')}</h3>
            <MonthlyHoursForm
              deployment={deployment}
              defaultValues={addDefaultValues}
              submitting={addMutation.isPending}
              submitLabel={t('staffDeployments.detail.save')}
              onSubmit={(values) =>
                addMutation.mutate({
                  month: values.month,
                  actualHours: Number(values.actualHours),
                  otAmount: values.otAmount ? Number(values.otAmount) : undefined,
                  notes: values.notes || undefined,
                })
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted">{t('staffDeployments.detail.noEligibleMonth')}</p>
        )}
      </Card>

      <Modal
        open={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        title={editingEntry ? t('staffDeployments.detail.editModalTitle', { month: editingEntry.month }) : ''}
      >
        {editingEntry && (
          <MonthlyHoursForm
            deployment={deployment}
            defaultValues={monthlyHoursEntryToForm(editingEntry)}
            submitting={updateMutation.isPending}
            submitLabel={t('staffDeployments.detail.save')}
            monthFixed
            onSubmit={(values) =>
              updateMutation.mutate({
                entryId: editingEntry._id,
                values: {
                  actualHours: Number(values.actualHours),
                  otAmount: values.otAmount ? Number(values.otAmount) : undefined,
                  notes: values.notes || undefined,
                },
              })
            }
          />
        )}
      </Modal>

      <Modal open={releasing} onClose={() => setReleasing(false)} title={t('staffDeployments.detail.releaseModalTitle', { name: deployment.workerName })}>
        <form
          onSubmit={handleReleaseSubmit((values) => releaseMutation.mutate(values))}
          noValidate
          className="space-y-4"
        >
          <p className="text-sm text-muted">{t('staffDeployments.detail.releaseModalMessage', { name: deployment.workerName })}</p>
          <Input
            label={t('staffDeployments.detail.releaseDateLabel')}
            type="date"
            error={releaseErrors.releaseDate?.message}
            {...registerRelease('releaseDate')}
          />
          <Textarea
            label={t('staffDeployments.detail.releaseNoteLabel')}
            error={releaseErrors.releaseNote?.message}
            {...registerRelease('releaseNote')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setReleasing(false)} disabled={releaseMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" isLoading={releaseMutation.isPending}>
              {t('staffDeployments.detail.release')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
