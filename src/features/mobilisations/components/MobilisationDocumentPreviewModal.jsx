/**
 * MobilisationDocumentPreviewModal — previews an uploaded mobilisation
 * document inline, mirroring the general Documents module's own
 * DocumentPreviewModal (features/documents/components/DocumentPreviewModal.jsx),
 * simplified for the fact that a mobilisation document has no version
 * history — just one file per upload.
 *
 * The file is fetched as an authenticated Blob (the in-memory bearer token
 * can't be sent by a plain <a>/<img>/<iframe src>) and shown from an object
 * URL: PDFs in an <iframe>, images in an <img>. Formats the browser can't
 * render inline (Word/Excel) show a "download to view" message instead. The
 * object URL is revoked when the modal closes to avoid leaking memory.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMobilisationDocumentBlob, downloadMobilisationDocument } from '../mobilisations.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { MOBILISATION_DOCUMENT_CATEGORY_LABELS } from '../../../lib/constants.js';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';

/** Bytes → "1.2 MB" / "340 KB". */
function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MobilisationDocumentPreviewModal({ mobilisationId, doc, open, onClose }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !doc) return undefined;
    let objectUrl;
    let cancelled = false;
    setUrl(null);
    setError(null);
    fetchMobilisationDocumentBlob(mobilisationId, doc._id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => !cancelled && setError(apiMessage(e, t('staffMobilisations.detail.preview.couldNotLoad'))));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, doc, mobilisationId, t]);

  if (!open || !doc) return null;

  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = doc.mimeType.startsWith('image/');

  return (
    <Modal open={open} onClose={onClose} title={doc.originalName} size="full">
      <div className="flex h-[78vh] flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              {t(`staffMobilisations.documentCategoryLabels.${doc.category}`, MOBILISATION_DOCUMENT_CATEGORY_LABELS[doc.category])}
            </Badge>
            <span className="text-xs text-muted">
              {formatDate(doc.uploadedAt)} · {fileSize(doc.size)}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => downloadMobilisationDocument(mobilisationId, doc._id, doc.originalName)}>
            {t('common.download')}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-xl border border-border bg-bg">
          {error ? (
            <p className="p-6 text-sm text-danger">{error}</p>
          ) : !url ? (
            <Spinner className="h-6 w-6 text-primary" />
          ) : isPdf ? (
            <iframe title={doc.originalName} src={url} className="h-full w-full" />
          ) : isImage ? (
            <img src={url} alt={doc.originalName} className="max-h-full w-auto object-contain" />
          ) : (
            <p className="p-6 text-center text-sm text-muted">
              {t('staffMobilisations.detail.preview.cannotPreview')}
              <br />
              {t('staffMobilisations.detail.preview.downloadToView')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
