/**
 * ChangePasswordModal — self-service password change, reachable from every
 * role's header (Dashboard and ESS shells both mount this). The server
 * revokes every session on success, this one included, so a successful
 * change is treated exactly like a forced logout: clear local state and send
 * the user back to /login with a clear reason, rather than leaving them on a
 * screen whose next API call will just 401.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changePasswordRequest } from '../auth.api.js';
import { changePasswordSchema, emptyChangePasswordForm } from '../auth.schema.js';
import { useAuth } from '../AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function ChangePasswordModal({ open, onClose, force = false }) {
  const { t } = useTranslation();
  // logout() here re-sends POST /auth/logout, which is a harmless no-op —
  // the server already cleared the cookie and deleted every session row as
  // part of changePasswordRequest() succeeding. Reusing it (rather than
  // inventing a second way to clear client auth state) keeps exactly one
  // code path responsible for "what does signing out mean on this client".
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyChangePasswordForm });

  const mutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: async () => {
      reset(emptyChangePasswordForm);
      onClose();
      await logout();
      toast.success(t('changePasswordModal.success'));
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function handleClose() {
    if (force) return;
    reset(emptyChangePasswordForm);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('changePasswordModal.title')} closable={!force}>
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="space-y-4"
      >
        <Input
          label={t('changePasswordModal.currentPassword')}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label={t('changePasswordModal.newPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label={t('changePasswordModal.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <p className="text-xs text-muted">{t('changePasswordModal.signOutNotice')}</p>
        <div className="flex justify-end gap-2 pt-2">
          {!force && (
            <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" isLoading={mutation.isPending}>
            {t('changePasswordModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
