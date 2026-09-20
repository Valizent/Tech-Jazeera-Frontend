/**
 * LogEntryForm — the one form behind both "add a log entry" (inline at the top
 * of the Daily log tab) and "edit an entry" (inside a modal). The parent owns
 * the mutation (create vs. update) and hands it in; this just collects and
 * validates the text + the day it's about.
 */
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { logFormSchema, todayInput } from '../dailyUpdates.schema.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function LogEntryForm({ mutation, defaultValues, submitLabel, onDone, onCancel }) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(logFormSchema),
    defaultValues: defaultValues ?? { text: '', date: todayInput() },
  });

  const onSubmit = (values) =>
    mutation.mutate(values, {
      onSuccess: () => {
        // Keep the chosen day for the next entry, clear only the text — logging
        // several things against the same day in a row is the normal case.
        reset({ text: '', date: values.date });
        onDone?.();
      },
    });

  const onInvalid = (formErrors) => {
    console.error('[dailyUpdates] log form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffDailyUpdates.formInvalid')
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-3">
      <Textarea
        label={t('staffDailyUpdates.log.form.text')}
        rows={3}
        placeholder={t('staffDailyUpdates.log.form.textPlaceholder')}
        error={errors.text?.message}
        {...register('text')}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          label={t('staffDailyUpdates.log.form.date')}
          type="date"
          max={todayInput()}
          error={errors.date?.message}
          className="sm:max-w-[200px]"
          {...register('date')}
        />
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" isLoading={mutation.isPending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
