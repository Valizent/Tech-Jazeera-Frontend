/**
 * Shared column definitions for the document Table, so the reusable panel and
 * the global page render rows identically. `showOwner` adds an owner column
 * for the global view (per-owner panels don't need it).
 */
import { currentVersion } from '../documents.schema.js';
import Badge from '../../../components/ui/Badge.jsx';
import ExpiryBadge from '../../../components/shared/ExpiryBadge.jsx';
import DocumentActionsCell from './DocumentActionsCell.jsx';

export function buildDocumentColumns({ showOwner = false, t } = {}) {
  return [
    {
      key: 'title',
      header: t('staffDocuments.columns.document'),
      render: (d) => {
        const v = currentVersion(d);
        return (
          <span>
            <span className="font-medium">{d.title}</span>
            <span className="block text-xs text-muted">{v.originalName}</span>
          </span>
        );
      },
    },
    ...(showOwner
      ? [
          {
            key: 'owner',
            header: t('staffDocuments.columns.owner'),
            render: (d) => {
              const name =
                d.owner?.companyName ?? d.owner?.fullName ?? t('staffDocuments.columns.unknownOwner');
              return (
                <span>
                  {name}
                  <span className="block text-xs text-muted">{t(`staffDocuments.ownerTypeLabels.${d.ownerType}`, d.ownerType)}</span>
                </span>
              );
            },
          },
        ]
      : []),
    { key: 'category', header: t('staffDocuments.columns.category'), render: (d) => <Badge variant="primary">{t(`staffDocuments.categoryLabels.${d.category}`, d.category)}</Badge> },
    { key: 'expiry', header: t('staffDocuments.columns.expiry'), render: (d) => <ExpiryBadge date={d.expiryDate} /> },
    {
      key: 'versions',
      header: t('staffDocuments.columns.versions'),
      hideOnMobile: true,
      className: 'text-center',
      render: (d) => d.versions.length,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (d) => <DocumentActionsCell doc={d} />,
    },
  ];
}
