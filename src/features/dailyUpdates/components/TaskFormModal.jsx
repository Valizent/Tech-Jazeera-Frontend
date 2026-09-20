/**
 * TaskFormModal — add a task, or edit one.
 *
 * Adding: someone who can assign (team-write) MUST pick which coordinator the
 * task is for; a coordinator with only their own workspace never sees that
 * picker — the task is theirs. Editing never changes the assignee (the
 * server's PATCH doesn't accept it), so the picker is omitted there.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDailyUpdate, updateDailyUpdate } from '../dailyUpdates.api.js';
import { buildTaskFormSchema, taskToForm } from '../dailyUpdates.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function TaskFormModal({ open, task, canAssign, coordinators, defaultCoordinatorId, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(task);
  const showAssignee = !isEdit && canAssign;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(buildTaskFormSchema(showAssignee)),
    defaultValues: { text: '', dueDate: '', coordinator: '' },
  });

  // Re-seed whenever the dialog opens (new vs. which task is being edited).
  useEffect(() => {
    if (!open) return;
    reset(task ? taskToForm(task) : { text: '', dueDate: '', coordinator: defaultCoordinatorId ?? '' });
  }, [open, task, defaultCoordinatorId, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) =>
      isEdit
        ? updateDailyUpdate(task._id, { text: values.text, dueDate: values.dueDate })
        : createDailyUpdate({
            kind: 'Task',
            text: values.text,
            ...(values.dueDate && { dueDate: values.dueDate }),
            ...(showAssignee && { coordinator: values.coordinator }),
          }),
    onSuccess: () => {
      toast.success(t(isEdit ? 'staffDailyUpdates.tasks.toasts.updated' : 'staffDailyUpdates.tasks.toasts.added'));
      queryClient.invalidateQueries({ queryKey: ['daily-updates'] });
      onClose();
    },
    onError: (error) => {
      console.error('[dailyUpdates] saving a task failed', error);
      toast.error(apiMessage(error));
    },
  });

  // Every client-side validation failure must be visible — react-hook-form
  // never calls a mutation's own onError for one (see the error-surfacing rule).
  const onInvalid = (formErrors) => {
    console.error('[dailyUpdates] task form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffDailyUpdates.formInvalid')
    );
  };

  const title = isEdit
    ? t('staffDailyUpdates.tasks.modalEditTitle')
    : canAssign
      ? t('staffDailyUpdates.tasks.modalAssignTitle')
      : t('staffDailyUpdates.tasks.modalAddTitle');

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        {showAssignee && (
          <Select label={t('staffDailyUpdates.tasks.form.assignTo')} error={errors.coordinator?.message} {...register('coordinator')}>
            <option value="">{t('staffDailyUpdates.tasks.form.assignPlaceholder')}</option>
            {(coordinators ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Textarea
          label={t('staffDailyUpdates.tasks.form.text')}
          rows={3}
          placeholder={t('staffDailyUpdates.tasks.form.textPlaceholder')}
          error={errors.text?.message}
          {...register('text')}
        />
        <Input label={t('staffDailyUpdates.tasks.form.dueDate')} type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
