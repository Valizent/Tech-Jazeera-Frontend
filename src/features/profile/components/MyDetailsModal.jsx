/**
 * MyDetailsModal — self-service "update my personal details" for the full
 * staff panel (Manager, HR, Accounts, Coordinator, Executive, Office
 * Secretary), reachable from the header avatar menu (DashboardLayout),
 * mirroring ChangePasswordModal/AvatarUploadModal's own pattern. Same
 * editable field set and validation as the ESS portal's MyProfilePage
 * (mobile/contact email/accommodation/emergency contact) — reuses that
 * schema directly rather than duplicating it. Admin has no linked Employee
 * record at all, so DashboardLayout doesn't offer this menu item to Admin.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMyProfile, updateMyProfile } from '../profile.api.js';
import { updateMyProfileFormSchema, profileToForm } from '../../ess/profile.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function MyDetailsModal({ open, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: employee, isPending } = useQuery({
    queryKey: ['profile', 'mine'],
    queryFn: getMyProfile,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(updateMyProfileFormSchema) });

  useEffect(() => {
    if (employee) reset(profileToForm(employee));
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', 'mine'], updated);
      toast.success(t('myDetailsModal.success'));
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title={t('myDetailsModal.title')}>
      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          <Input label={t('myDetailsModal.mobile')} error={errors.mobile?.message} {...register('mobile')} />
          <Input label={t('myDetailsModal.email')} type="email" error={errors.email?.message} {...register('email')} />
          <Input label={t('myDetailsModal.accommodation')} error={errors.accommodation?.message} {...register('accommodation')} />
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('myDetailsModal.emergencyContact')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label={t('myDetailsModal.contactName')}
                error={errors.emergencyContact?.name?.message}
                {...register('emergencyContact.name')}
              />
              <Input
                label={t('myDetailsModal.contactPhone')}
                error={errors.emergencyContact?.phone?.message}
                {...register('emergencyContact.phone')}
              />
              <Input
                label={t('myDetailsModal.contactRelation')}
                error={errors.emergencyContact?.relation?.message}
                {...register('emergencyContact.relation')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
