/**
 * AvatarUploadModal — self-service profile photo, reachable by clicking the
 * header avatar circle (every role, both the Dashboard and ESS shells mount
 * this the same way ChangePasswordModal is mounted). Unlike a password
 * change, this never touches sessions — the new photo just appears.
 */
import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { uploadAvatarRequest, removeAvatarRequest } from '../auth.api.js';
import { useAuth } from '../AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { AVATAR_MAX_MB, AVATAR_ACCEPT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function AvatarUploadModal({ open, onClose }) {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null); // local object URL before upload
  const [pendingFile, setPendingFile] = useState(null);

  const uploadMutation = useMutation({
    mutationFn: uploadAvatarRequest,
    onSuccess: ({ avatarUrl }) => {
      updateUser({ avatarUrl });
      toast.success(t('avatarModal.uploadSuccess'));
      resetLocal();
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: removeAvatarRequest,
    onSuccess: () => {
      updateUser({ avatarUrl: null });
      toast.success(t('avatarModal.removeSuccess'));
      resetLocal();
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function resetLocal() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetLocal();
    onClose();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast.error(t('avatarModal.fileTooLarge', { maxMb: AVATAR_MAX_MB }));
      e.target.value = '';
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  const displayUrl = preview ?? user?.avatarUrl;
  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <Modal open={open} onClose={busy ? () => {} : handleClose} title={t('avatarModal.title')}>
      <div className="flex flex-col items-center gap-4">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="h-28 w-28 rounded-full object-cover ring-2 ring-inset ring-primary/20"
          />
        ) : (
          <div className="grid h-28 w-28 place-items-center rounded-full bg-primary/10 text-3xl font-semibold text-primary ring-2 ring-inset ring-primary/20">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            {t('avatarModal.chooseImage')}
          </Button>
          {user?.avatarUrl && !pendingFile && (
            <Button icon="trash"
              type="button" variant="danger-solid"
              onClick={() => removeMutation.mutate()}
              isLoading={removeMutation.isPending}
              disabled={busy}
            >
              {t('avatarModal.removePhoto')}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted">{t('avatarModal.fileHint', { maxMb: AVATAR_MAX_MB })}</p>

        <div className="flex w-full justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button icon="check" variant="success-solid"
            type="button"
            onClick={() => uploadMutation.mutate(pendingFile)}
            isLoading={uploadMutation.isPending}
            disabled={!pendingFile || busy}
          >
            {t('avatarModal.savePhoto')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
