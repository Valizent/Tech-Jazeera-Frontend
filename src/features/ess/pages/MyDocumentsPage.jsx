/**
 * MyDocumentsPage — a Worker's own uploaded documents (P2-M2), read-only.
 * Uploading stays an HR/Admin/Manager job (documents module) — a worker
 * views and downloads what's already on file for them.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listMyDocuments } from '../ess.api.js';
import MyDocumentPreviewModal from '../components/MyDocumentPreviewModal.jsx';
import { formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import ExpiryBadge from '../../../components/shared/ExpiryBadge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function MyDocumentsPage() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'documents'],
    queryFn: () => listMyDocuments({ limit: 100 }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('documents.title')} description={t('documents.description')} />

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title={t('documents.loadError')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title={t('documents.empty')} description={t('documents.emptyDescription')} />
      ) : (
        <Card className="divide-y divide-border">
          {data.items.map((doc) => (
            <button
              key={doc._id}
              onClick={() => setPreview(doc)}
              className="-mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left text-sm transition-colors hover:bg-bg/60"
            >
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-muted">
                  {/* Fixed 2026-09-29, a real audit finding: `mr-2` is a
                      physical class that doesn't flip under dir="rtl" 
                      `me-2` (logical, "margin-end") renders the gap on the
                      correct side in Arabic too. */}
                  <Badge variant="default" className="me-2">{doc.category}</Badge>
                  {t('documents.uploaded', { date: formatDate(doc.createdAt) })}
                </p>
              </div>
              <ExpiryBadge date={doc.expiryDate} />
            </button>
          ))}
        </Card>
      )}

      <MyDocumentPreviewModal doc={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />
    </div>
  );
}
