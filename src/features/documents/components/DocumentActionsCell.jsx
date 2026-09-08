/**
 * DocumentActionsCell — the per-row actions for a document: preview, download,
 * upload a new version, and delete. Centralised here so the reusable panel and
 * the global page share identical behaviour instead of duplicating it.
 *
 * "New version" uses a hidden file input; picking a file uploads it as the
 * next version. Delete goes through the standard confirm dialog.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addVersion, deleteDocument, downloadDocumentFile } from '../documents.api.js';
import { currentVersion } from '../documents.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { DOCUMENT_ACCEPT } from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import Button from '../../../components/ui/Button.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import DocumentPreviewModal from './DocumentPreviewModal.jsx';

export default function DocumentActionsCell({ doc }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canWrite = Boolean(user.sectionAccess?.includes('documentsManage'));
  const canDelete = canWrite;
  const version = currentVersion(doc);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const versionMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return addVersion(doc._id, fd);
    },
    onSuccess: () => {
      toast.success(t('staffDocuments.actionsCell.versionUploadedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(doc._id),
    onSuccess: () => {
      toast.success(t('staffDocuments.actionsCell.deletedToast'));
      setConfirmingDelete(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

  return (
    <span className="flex justify-end gap-1">
      <Button size="sm" variant="secondary" onClick={() => setPreviewing(true)}>
        {t('staffDocuments.actionsCell.view')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => downloadDocumentFile(doc._id, version.version, version.originalName)}
      >
        {t('staffDocuments.actionsCell.download')}
      </Button>
      {canWrite && (
        <>
          <Button
            size="sm"
            variant="ghost"
            isLoading={versionMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('staffDocuments.actionsCell.newVersion')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) versionMutation.mutate(f);
              e.target.value = ''; // allow re-selecting the same file later
            }}
          />
        </>
      )}
      {canDelete && (
        <Button size="sm" variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
          {t('common.delete')}
        </Button>
      )}

      <DocumentPreviewModal doc={doc} open={previewing} onClose={() => setPreviewing(false)} />
      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffDocuments.actionsCell.deleteConfirmTitle')}
        message={t('staffDocuments.actionsCell.deleteConfirmMessage', { title: doc.title, count: doc.versions.length })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </span>
  );
}
