/**
 * NewChatModal - start a direct chat (pick one person) or a group (a name and several people). Starting a
 * direct chat with someone you already talk to just opens the existing one.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import SearchableSelect from '../../../components/ui/SearchableSelect.jsx';
import MultiSelect from '../../../components/ui/MultiSelect.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { createConversation, listChatDirectory } from '../chat.api.js';
import { newChatSchema, emptyNewChat } from '../chat.schema.js';

export default function NewChatModal({ open, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(newChatSchema), defaultValues: emptyNewChat });
  const [type, personId, memberIds] = useWatch({ control, name: ['type', 'personId', 'memberIds'] });

  useEffect(() => {
    if (open) reset(emptyNewChat);
  }, [open, reset]);

  const directory = useQuery({ queryKey: ['chat', 'directory'], queryFn: listChatDirectory, enabled: open });
  const people = directory.data ?? [];

  const create = useMutation({
    mutationFn: (values) =>
      createConversation(
        values.type === 'direct' ? { type: 'direct', memberIds: [values.personId] } : { type: 'group', name: values.name, memberIds: values.memberIds }
      ),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      onClose();
      navigate(`/chat/${conversation.id}`);
    },
    onError: (error) => {
      console.error('[chat] could not start the conversation', error);
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[chat] new chat form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('chat.newChatInvalid'));
  };

  function toggleMember(id) {
    setValue('memberIds', memberIds.includes(id) ? memberIds.filter((m) => m !== id) : [...memberIds, id], { shouldValidate: true });
  }

  return (
    <Modal open={open} onClose={onClose} title={t('chat.newChatTitle')}>
      <form onSubmit={handleSubmit((values) => create.mutate(values), onInvalid)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {['direct', 'group'].map((option) => (
            <Button key={option} variant={type === option ? 'primary' : 'secondary'} onClick={() => setValue('type', option)}>
              {t(`chat.${option}`)}
            </Button>
          ))}
        </div>

        {directory.isError && <p className="text-sm text-danger">{t('chat.directoryFailed')}</p>}

        {type === 'direct' ? (
          <SearchableSelect
            label={t('chat.person')}
            value={personId}
            onChange={(value) => setValue('personId', value, { shouldValidate: true })}
            options={people.map((p) => ({ value: p.id, label: `${p.name} (${p.role})` }))}
            placeholder={t('chat.choosePerson')}
          />
        ) : (
          <>
            <Input label={t('chat.groupName')} error={errors.name?.message} {...register('name')} />
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-text">{t('chat.members')}</span>
              <MultiSelect
                items={people}
                selected={memberIds}
                onToggle={toggleMember}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder={t('chat.chooseMembers')}
                emptyMessage={t('chat.noPeople')}
              />
              {errors.memberIds?.message && <p className="text-xs text-danger">{errors.memberIds.message}</p>}
            </div>
          </>
        )}
        {type === 'direct' && errors.personId?.message && <p className="text-xs text-danger">{errors.personId.message}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="success-solid" isLoading={create.isPending}>
            {type === 'direct' ? t('chat.startChat') : t('chat.createGroup')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
