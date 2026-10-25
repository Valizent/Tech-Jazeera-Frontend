/**
 * GroupInfoModal - who is in a group. Everyone can see the members and leave; a group admin can also rename the
 * group, add people and remove people.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import MultiSelect from '../../../components/ui/MultiSelect.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { leaveConversation, listChatDirectory, updateConversation } from '../chat.api.js';
import { renameGroupSchema } from '../chat.schema.js';

export default function GroupInfoModal({ conversation, myId, open, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toAdd, setToAdd] = useState([]);
  const [removing, setRemoving] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const isAdmin = conversation.members.find((m) => m.id === myId)?.role === 'admin';
  const memberIds = conversation.members.map((m) => m.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(renameGroupSchema), defaultValues: { name: conversation.name } });

  useEffect(() => {
    if (open) {
      reset({ name: conversation.name });
      setToAdd([]);
    }
  }, [open, conversation.name, reset]);

  const directory = useQuery({ queryKey: ['chat', 'directory'], queryFn: listChatDirectory, enabled: open && isAdmin });
  const candidates = (directory.data ?? []).filter((p) => !memberIds.includes(p.id));

  const update = useMutation({
    mutationFn: (payload) => updateConversation(conversation.id, payload),
    onSuccess: () => {
      toast.success(t('chat.groupUpdated'));
      setToAdd([]);
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (error) => {
      console.error('[chat] could not update the group', error);
      toast.error(apiMessage(error));
    },
  });

  const leave = useMutation({
    mutationFn: () => leaveConversation(conversation.id),
    onSuccess: () => {
      toast.success(t('chat.left'));
      // The thread is no longer ours to read: drop it instead of refetching it into a 404.
      queryClient.removeQueries({ queryKey: ['chat', 'messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
      onClose();
      navigate('/chat');
    },
    onError: (error) => {
      console.error('[chat] could not leave the group', error);
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[chat] rename form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('chat.renameInvalid'));
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('chat.groupInfo')}>
        <div className="space-y-5">
          {isAdmin && (
            <form onSubmit={handleSubmit((values) => update.mutate({ name: values.name }), onInvalid)} noValidate className="flex items-end gap-2">
              <Input label={t('chat.groupName')} error={errors.name?.message} className="flex-1" {...register('name')} />
              <Button type="submit" variant="success-solid" icon="check" isLoading={update.isPending}>
                {t('common.save')}
              </Button>
            </form>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('chat.members')} ({conversation.members.length})</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {conversation.members.map((member) => (
                <li key={member.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {member.name}
                    {member.id === myId && <span className="text-muted"> ({t('chat.you')})</span>}
                  </span>
                  {member.role === 'admin' && <Badge variant="primary">{t('chat.admin')}</Badge>}
                  {isAdmin && member.id !== myId && (
                    <Button size="sm" variant="danger" icon="trash" aria-label={t('common.remove')} onClick={() => setRemoving(member)} />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t('chat.addMembers')}</h3>
              <MultiSelect
                items={candidates}
                selected={toAdd}
                onToggle={(id) => setToAdd((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]))}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder={t('chat.chooseMembers')}
                emptyMessage={t('chat.noPeople')}
              />
              <Button variant="success-solid" icon="plus" disabled={toAdd.length === 0} isLoading={update.isPending} onClick={() => update.mutate({ addMemberIds: toAdd })}>
                {t('chat.addSelected')}
              </Button>
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="danger" onClick={() => setLeaving(true)}>
              {t('chat.leaveGroup')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('chat.removeMemberTitle')}
        message={t('chat.removeMemberMessage', { name: removing?.name })}
        confirmLabel={t('common.remove')}
        loading={update.isPending}
        onConfirm={() => update.mutate({ removeMemberIds: [removing.id] })}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={leaving}
        title={t('chat.leaveTitle')}
        message={t('chat.leaveMessage', { name: conversation.name })}
        confirmLabel={t('chat.leaveGroup')}
        loading={leave.isPending}
        onConfirm={() => leave.mutate()}
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}
