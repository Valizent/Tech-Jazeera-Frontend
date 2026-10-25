/**
 * ReportDialog - flag someone else's message for a moderator. The reason is optional. Only the reported message
 * is ever shown to a moderator, never the rest of the conversation.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { reportChatMessage } from '../chat.api.js';
import { reportSchema } from '../chat.schema.js';

export default function ReportDialog({ message, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(reportSchema), defaultValues: { reason: '' } });

  useEffect(() => {
    reset({ reason: '' });
  }, [message, reset]);

  const report = useMutation({
    mutationFn: (values) => reportChatMessage(message.id, { reason: values.reason || undefined }),
    onSuccess: () => {
      toast.success(t('chat.reported'));
      onClose();
    },
    onError: (error) => {
      console.error('[chat] report failed', error);
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[chat] report form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('chat.reportInvalid'));
  };

  return (
    <Modal open={Boolean(message)} onClose={onClose} title={t('chat.reportTitle')}>
      <form onSubmit={handleSubmit((values) => report.mutate(values), onInvalid)} noValidate className="space-y-4">
        <p className="text-sm text-muted">{t('chat.reportIntro')}</p>
        <Textarea label={t('chat.reportReason')} rows={3} error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger-solid" isLoading={report.isPending}>
            {t('chat.reportSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
