/**
 * StageManagerModal — add, rename, reorder and delete the board's stages.
 * One modal with two views (the list, and an add/edit form that replaces it)
 * rather than a second modal on top — stacked dialogs would both close on a
 * single Escape. Every change applies to everyone, so deleting is refused by
 * the server while a stage still holds cards.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStage, updateStage, deleteStage, reorderStages } from '../requirements.api.js';
import { stageFormSchema, emptyStageForm, stageToForm } from '../requirements.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';

function StageForm({ stage, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(stageFormSchema), defaultValues: stage ? stageToForm(stage) : emptyStageForm });
  const isTerminal = watch('isTerminal');

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        name: values.name,
        // A closed stage is never flagged stale — send null rather than a value the server would discard.
        staleAfterDays: values.isTerminal || values.staleAfterDays === '' ? null : Number(values.staleAfterDays),
        isTerminal: values.isTerminal,
        notifyOnEnter: values.notifyOnEnter,
      };
      return stage ? updateStage(stage._id, payload) : createStage(payload);
    },
    onSuccess: () => {
      toast.success(t(stage ? 'staffRequirements.stages.toasts.updated' : 'staffRequirements.stages.toasts.added'));
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      onDone();
    },
    onError: (error) => {
      console.error('[requirements] saving a stage failed', error);
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[requirements] stage form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffRequirements.formInvalid')
    );
  };

  return (
    <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
      <Input label={t('staffRequirements.stages.form.name')} error={errors.name?.message} {...register('name')} />
      <div>
        <Input
          label={t('staffRequirements.stages.form.staleAfter')}
          type="number"
          min="1"
          max="365"
          placeholder={t('staffRequirements.stages.form.staleAfterPlaceholder')}
          disabled={isTerminal}
          error={errors.staleAfterDays?.message}
          {...register('staleAfterDays')}
        />
        <p className="mt-1 text-xs text-muted">{t('staffRequirements.stages.form.staleAfterHint')}</p>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          {...register('isTerminal', {
            onChange: (e) => e.target.checked && setValue('staleAfterDays', ''),
          })}
        />
        <span>
          <span className="font-medium">{t('staffRequirements.stages.form.isTerminal')}</span>
          <span className="block text-xs text-muted">{t('staffRequirements.stages.form.isTerminalHint')}</span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border" {...register('notifyOnEnter')} />
        <span>
          <span className="font-medium">{t('staffRequirements.stages.form.notifyOnEnter')}</span>
          <span className="block text-xs text-muted">{t('staffRequirements.stages.form.notifyOnEnterHint')}</span>
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone} disabled={saveMutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={saveMutation.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

export default function StageManagerModal({ open, stages, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null = list view, {} = add, {...stage} = edit
  const [toDelete, setToDelete] = useState(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requirements'] });
  const onError = (what) => (error) => {
    console.error(`[requirements] ${what} failed`, error);
    toast.error(apiMessage(error));
  };

  const reorderMutation = useMutation({
    mutationFn: (ids) => reorderStages(ids),
    onSuccess: invalidate,
    onError: onError('reordering stages'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStage(id),
    onSuccess: () => {
      toast.success(t('staffRequirements.stages.toasts.deleted'));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => {
      setToDelete(null);
      onError('deleting a stage')(error);
    },
  });

  function move(index, delta) {
    const ids = stages.map((s) => s._id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorderMutation.mutate(ids);
  }

  function handleClose() {
    setEditing(null);
    onClose();
  }

  const title = editing
    ? editing._id
      ? t('staffRequirements.stages.editTitle')
      : t('staffRequirements.stages.addTitle')
    : t('staffRequirements.stages.title');

  return (
    // While the delete confirmation is up, Escape should dismiss only IT — not this
    // dialog underneath (both listen on window).
    <Modal open={open} onClose={toDelete ? () => {} : handleClose} title={title} size="lg">
      {editing ? (
        <StageForm key={editing._id ?? 'new'} stage={editing._id ? editing : null} onDone={() => setEditing(null)} />
      ) : (
        <div>
          <p className="mb-4 text-sm text-muted">{t('staffRequirements.stages.description')}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {stages.map((stage, index) => (
              <li key={stage._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{stage.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {stage.staleAfterDays && <Badge variant="warning">{t('staffRequirements.stage.flagAfter', { count: stage.staleAfterDays })}</Badge>}
                    {stage.notifyOnEnter && <Badge variant="primary">{t('staffRequirements.stage.notifies')}</Badge>}
                    {stage.isTerminal && <Badge>{t('staffRequirements.stage.closed')}</Badge>}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => move(index, -1)}
                    aria-label={t('staffRequirements.stages.moveUp', { name: stage.name })}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === stages.length - 1 || reorderMutation.isPending}
                    onClick={() => move(index, 1)}
                    aria-label={t('staffRequirements.stages.moveDown', { name: stage.name })}
                  >
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(stage)}>
                    {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(stage)}>
                    {t('common.delete')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="secondary" onClick={handleClose}>
              {t('common.close')}
            </Button>
            <Button onClick={() => setEditing({})}>{t('staffRequirements.stages.addStage')}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffRequirements.stages.deleteConfirmTitle')}
        message={t('staffRequirements.stages.deleteConfirmMessage', { name: toDelete?.name })}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </Modal>
  );
}
