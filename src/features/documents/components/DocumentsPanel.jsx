/**
 * DocumentsPanel — the documents section for one owner (an employee or a
 * client). Reused on both profiles. Fetches that owner's documents, shows the
 * shared table, and offers upload (owner locked).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listDocuments } from '../documents.api.js';
import { buildDocumentColumns } from './documentColumns.jsx';
import DocumentUploadModal from './DocumentUploadModal.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function DocumentsPanel({ ownerType, ownerId, ownerName }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = Boolean(user.sectionAccessWrite?.includes('documentsManage'));
  const [uploading, setUploading] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['documents', { ownerType, owner: ownerId }],
    queryFn: () => listDocuments({ ownerType, owner: ownerId, limit: 100 }),
  });

  const columns = buildDocumentColumns({ t });
  const docs = data?.items ?? [];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDocuments.panel.title')}</h2>
        {canWrite && (
          <Button size="sm" onClick={() => setUploading(true)}>
            {t('staffDocuments.panel.upload')}
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Table
          columns={columns}
          rows={docs}
          rowKey={(d) => d._id}
          emptyState={
            <EmptyState
              title={t('staffDocuments.panel.emptyTitle')}
              description={
                canWrite
                  ? t('staffDocuments.panel.emptyDescriptionWrite')
                  : t('staffDocuments.panel.emptyDescriptionView')
              }
              action={canWrite ? <Button onClick={() => setUploading(true)}>{t('staffDocuments.panel.uploadDocument')}</Button> : null}
            />
          }
        />
      )}

      <DocumentUploadModal
        open={uploading}
        onClose={() => setUploading(false)}
        fixedOwner={{ type: ownerType, id: ownerId, name: ownerName }}
      />
    </Card>
  );
}
