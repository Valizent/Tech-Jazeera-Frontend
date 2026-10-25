/**
 * MessageContent - what is inside a message: the text, and its attachment (an image preview that opens larger,
 * or a PDF chip with Open / Download). Used by the chat thread and by the moderation page, which differ only in
 * where the file comes from, so the caller passes `fileId` and `fetchBlob`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, formatFileSize } from '../../../lib/utils.js';
import AuthedImage from './AuthedImage.jsx';
import { isImage, openBlobInTab, saveBlob } from '../chat.utils.js';

const FILE_ICON =
  'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z';

export default function MessageContent({ message, fileId, fetchBlob }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { attachment } = message;

  async function handleFile(action) {
    setBusy(true);
    try {
      const blob = await fetchBlob(fileId);
      if (action === 'download') saveBlob(blob, attachment.name);
      else openBlobInTab(blob);
    } catch (error) {
      console.error('[chat] could not open the file', error);
      toast.error(apiMessage(error, t('chat.fileUnavailable')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {attachment && isImage(attachment.mimeType) && (
        <>
          <AuthedImage
            fileId={fileId}
            fetchBlob={fetchBlob}
            alt={attachment.name}
            className="max-h-64 max-w-full rounded-lg object-cover"
            onClick={() => setPreviewOpen(true)}
          />
          <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={attachment.name} size="xl">
            <AuthedImage fileId={fileId} fetchBlob={fetchBlob} alt={attachment.name} className="mx-auto max-h-[70vh] max-w-full" />
            <div className="mt-4 flex justify-end">
              <Button variant="info" icon="download" isLoading={busy} onClick={() => handleFile('download')}>
                {t('chat.download')}
              </Button>
            </div>
          </Modal>
        </>
      )}

      {attachment && !isImage(attachment.mimeType) && (
        <div className="min-w-48 space-y-2 rounded-lg border border-border bg-bg/60 p-2.5 text-text">
          <div className="flex items-center gap-3">
            <Icon d={FILE_ICON} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{attachment.name}</p>
              <p className="text-xs text-muted">{formatFileSize(attachment.size)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="soft" icon="eye" isLoading={busy} onClick={() => handleFile('open')}>
              {t('chat.open')}
            </Button>
            <Button size="sm" variant="info" icon="download" disabled={busy} onClick={() => handleFile('download')}>
              {t('chat.download')}
            </Button>
          </div>
        </div>
      )}

      {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
    </div>
  );
}
