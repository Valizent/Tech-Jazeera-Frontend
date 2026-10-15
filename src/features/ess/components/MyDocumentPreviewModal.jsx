/**
 * MyDocumentPreviewModal — the Worker-facing equivalent of
 * documents/components/DocumentPreviewModal.jsx, scoped to /api/me/documents.
 * Same authenticated-Blob pattern; trimmed to the current version only (a
 * worker reads their own file, they don't need the full version-history UI
 * the admin document center has).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMyDocumentFileBlob, downloadMyDocumentFile } from '../ess.api.js';
import { apiMessage } from '../../../lib/utils.js';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import ExpiryBadge from '../../../components/shared/ExpiryBadge.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';

function currentVersion(doc) {
  return doc.versions[doc.versions.length - 1];
}

export default function MyDocumentPreviewModal({ doc, open, onClose }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const version = doc ? currentVersion(doc) : null;

  useEffect(() => {
    if (!open || !doc) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setError(null);
    getMyDocumentFileBlob(doc._id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => !cancelled && setError(apiMessage(e, t('documents.preview.loadError'))));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, doc]);

  if (!open || !doc) return null;

  const isPdf = version.mimeType === 'application/pdf';
  const isImage = version.mimeType.startsWith('image/');

  return (
    <Modal open={open} onClose={onClose} title={doc.title} size="xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="grid h-[52vh] min-w-0 place-items-center overflow-hidden rounded-xl border border-border bg-bg lg:h-[70vh] lg:flex-1">
          {error ? (
            <p className="p-6 text-sm text-danger">{error}</p>
          ) : !url ? (
            <Spinner className="h-6 w-6 text-primary" />
          ) : isPdf ? (
            <iframe title={doc.title} src={url} className="h-full w-full" />
          ) : isImage ? (
            <img src={url} alt={doc.title} className="max-h-full w-auto object-contain" />
          ) : (
            <p className="p-6 text-center text-sm text-muted">
              {t('documents.preview.cannotPreview')}
              <br />
              {t('documents.preview.downloadToView')}
            </p>
          )}
        </div>

        <div className="space-y-3 lg:w-72 lg:shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{doc.category}</Badge>
            <ExpiryBadge date={doc.expiryDate} />
          </div>
          <Button icon="download" variant="info"
            className="w-full"
            onClick={() => downloadMyDocumentFile(doc._id, version.version, version.originalName)}
          >
            {t('common.download')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
