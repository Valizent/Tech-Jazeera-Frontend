/**
 * RequirementDetailModal — one card in full: its details, a stage control, a
 * timeline of everything that has happened to it (stage moves AND the updates
 * coordinators wrote on it), and the form for writing a new update. Editing
 * hands off to RequirementFormModal (the page shows one or the other, never
 * both). What each button does comes from the server's `permissions`.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRequirement, moveRequirement, deleteRequirement } from '../requirements.api.js';
import { createDailyUpdate } from '../../dailyUpdates/dailyUpdates.api.js';
import { updateFormSchema } from '../requirements.schema.js';
import { apiMessage, cn, formatDate, formatDateTime } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import ProfileField from '../../../components/ui/ProfileField.jsx';
import CandidatesSection from './CandidatesSection.jsx';

export default function RequirementDetailModal({ id, stages, onClose, onEdit }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false); // a child dialog is up

  const { data: requirement, isPending, isError, refetch } = useQuery({
    queryKey: ['requirements', 'detail', id],
    queryFn: () => getRequirement(id),
    enabled: Boolean(id),
  });

  const stageName = (stageId) => stages.find((s) => s._id === stageId)?.name ?? '—';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requirements'] });
  const onError = (what) => (error) => {
    console.error(`[requirements] ${what} failed`, error);
    toast.error(apiMessage(error));
  };

  const moveMutation = useMutation({
    mutationFn: (stage) => moveRequirement(id, stage),
    onSuccess: (updated) => {
      toast.success(t('staffRequirements.toasts.moved', { stage: stageName(updated.stage) }));
      invalidate();
    },
    onError: onError('moving a requirement'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRequirement(id),
    onSuccess: () => {
      toast.success(t('staffRequirements.toasts.deleted'));
      setConfirmDelete(false);
      invalidate();
      onClose();
    },
    onError: (error) => {
      setConfirmDelete(false);
      onError('deleting a requirement')(error);
    },
  });

  // The update, then (only if a stage was picked) the move — two calls, because
  // an update is a Daily Updates log entry and a move is a board action; if the
  // move fails the update is already saved and the toast says what failed.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(updateFormSchema), defaultValues: { text: '', stage: '' } });

  const updateMutation = useMutation({
    mutationFn: async ({ text, stage }) => {
      await createDailyUpdate({ kind: 'Log', text, requirement: id });
      if (stage && stage !== requirement.stage) await moveRequirement(id, stage);
    },
    onSuccess: () => {
      toast.success(t('staffRequirements.toasts.updateAdded'));
      reset({ text: '', stage: '' });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['daily-updates'] });
    },
    onError: (error) => {
      // The update may have been saved even though the move after it failed — refresh either way.
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['daily-updates'] });
      onError('adding an update')(error);
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[requirements] update form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffRequirements.formInvalid')
    );
  };

  // Stage moves and written updates, newest first, as one timeline.
  const timeline = useMemo(() => {
    if (!requirement) return [];
    const moves = requirement.stageHistory.map((h, index) => ({
      key: `m${index}`,
      at: h.movedAt,
      type: index === 0 ? 'created' : 'moved',
      stageName: h.stageName,
      by: h.movedBy?.name,
    }));
    const updates = requirement.updates.map((u) => ({ key: u._id, at: u.createdAt, type: 'update', text: u.text, by: u.coordinator?.name }));
    return [...moves, ...updates].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [requirement]);

  const p = requirement?.permissions;

  return (
    // While a dialog on top of this one is up (the delete confirmation, or a
    // candidate's form/confirm), Escape should dismiss only IT (all listen on window).
    <Modal
      open
      onClose={confirmDelete || candidateDialogOpen ? () => {} : onClose}
      title={requirement ? `${requirement.serialNumber} · ${requirement.clientName}` : t('staffRequirements.detail.loading')}
      size="lg"
    >
      {isError ? (
        <div className="py-8 text-center">
          <p className="font-medium">{t('staffRequirements.detail.notFoundTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('staffRequirements.detail.notFoundDescription')}</p>
          <Button className="mt-4" variant="secondary" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{stageName(requirement.stage)}</Badge>
            {requirement.stale && <Badge variant="danger">{t('staffRequirements.card.stale')}</Badge>}
            <span className="text-sm text-muted">{t('staffRequirements.card.daysInStage', { count: requirement.daysInStage })}</span>
            {requirement.client && <Badge variant="success">{t('staffRequirements.detail.linkedClient')}</Badge>}
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <ProfileField label={t('staffRequirements.form.jobTitleLabel')}>
              {requirement.jobTitle} <span className="tabular-nums text-muted">× {requirement.headcount}</span>
            </ProfileField>
            <ProfileField label={t('staffRequirements.form.neededByLabel')}>{requirement.neededBy ? formatDate(requirement.neededBy) : null}</ProfileField>
            <ProfileField label={t('staffRequirements.form.siteLabel')}>{requirement.site}</ProfileField>
            <ProfileField label={t('staffRequirements.form.coordinatorsLabel')}>{requirement.coordinators.map((c) => c.name).join(', ')}</ProfileField>
            <ProfileField label={t('staffRequirements.detail.createdBy')}>
              {requirement.createdBy?.name} · {formatDate(requirement.createdAt)}
            </ProfileField>
            {requirement.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted">{t('staffRequirements.form.notesLabel')}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{requirement.notes}</dd>
              </div>
            )}
          </dl>

          <CandidatesSection requirement={requirement} canEdit={p.edit} onBusyChange={setCandidateDialogOpen} />

          {p.move && (
            <Select
              label={t('staffRequirements.detail.stage')}
              value={requirement.stage}
              disabled={moveMutation.isPending}
              onChange={(e) => moveMutation.mutate(e.target.value)}
              className="sm:max-w-xs"
            >
              {stages.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}

          {p.addUpdate && (
            <form onSubmit={handleSubmit((values) => updateMutation.mutate(values), onInvalid)} noValidate className="space-y-3 rounded-xl border border-border bg-bg/40 p-4">
              <h3 className="text-sm font-semibold">{t('staffRequirements.detail.addUpdateHeading')}</h3>
              <Textarea
                aria-label={t('staffRequirements.detail.addUpdateHeading')}
                rows={3}
                placeholder={t('staffRequirements.detail.updatePlaceholder')}
                error={errors.text?.message}
                {...register('text')}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Select label={t('staffRequirements.detail.alsoMove')} className="sm:max-w-xs" {...register('stage')}>
                  <option value="">{t('staffRequirements.detail.keepInStage', { stage: stageName(requirement.stage) })}</option>
                  {stages
                    .filter((s) => s._id !== requirement.stage)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
                <Button type="submit" isLoading={updateMutation.isPending}>
                  {t('staffRequirements.detail.addUpdate')}
                </Button>
              </div>
            </form>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold">{t('staffRequirements.detail.timeline')}</h3>
            <ol className="relative space-y-4 border-s border-border ps-5">
              {timeline.map((entry) => (
                <li key={entry.key} className="relative">
                  <span
                    className={cn(
                      'absolute -start-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface',
                      entry.type === 'update' ? 'bg-primary' : 'bg-muted/60'
                    )}
                  />
                  {entry.type === 'update' ? (
                    <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
                  ) : (
                    <p className="text-sm text-muted">
                      {t(entry.type === 'created' ? 'staffRequirements.detail.createdIn' : 'staffRequirements.detail.movedTo', { stage: entry.stageName })}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">
                    {entry.by ? `${entry.by} · ` : ''}
                    {formatDateTime(entry.at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {(p.edit || p.remove) && (
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {p.remove && (
                <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                  {t('common.delete')}
                </Button>
              )}
              {p.edit && <Button variant="secondary" onClick={() => onEdit(requirement)}>{t('common.edit')}</Button>}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('staffRequirements.detail.deleteConfirmTitle')}
        message={t('staffRequirements.detail.deleteConfirmMessage', { name: requirement?.serialNumber })}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}
