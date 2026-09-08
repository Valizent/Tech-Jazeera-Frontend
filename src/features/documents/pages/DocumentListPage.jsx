/**
 * Document Center — the global, searchable list of every document, with
 * filters (owner type, category, search, expiring) and upload (owner picked
 * in the modal). Per-owner document sections live on the profiles; this is
 * the company-wide view.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listDocuments } from '../documents.api.js';
import { buildDocumentColumns } from '../components/documentColumns.jsx';
import DocumentUploadModal from '../components/DocumentUploadModal.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { DOCUMENT_CATEGORIES, DOCUMENT_OWNER_TYPES } from '../../../lib/constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function DocumentListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = Boolean(user.sectionAccess?.includes('documentsManage'));
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    search: '',
    ownerType: '',
    category: '',
    expiring: false,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['documents', params],
    queryFn: () =>
      listDocuments({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.ownerType && { ownerType: params.ownerType }),
        ...(params.category && { category: params.category }),
        ...(params.expiring && { expiring: 'true' }),
      }),
    placeholderData: keepPreviousData,
  });

  const columns = buildDocumentColumns({ showOwner: true, t });
  const noFilters = !params.search && !params.ownerType && !params.category && !params.expiring;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffDocuments.list.pageTitle')}
        description={t('staffDocuments.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={canWrite && <Button onClick={() => setUploading(true)}>{t('staffDocuments.list.uploadDocument')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffDocuments.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffDocuments.list.searchAriaLabel')}
        />
        <Select
          value={params.ownerType}
          onChange={(e) => setParams((p) => ({ ...p, ownerType: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label={t('staffDocuments.list.filterOwnerAriaLabel')}
        >
          <option value="">{t('staffDocuments.list.allOwners')}</option>
          {DOCUMENT_OWNER_TYPES.map((ot) => (
            <option key={ot} value={ot}>
              {t(`staffDocuments.ownerTypeLabels.${ot}`, ot)}
            </option>
          ))}
        </Select>
        <Select
          value={params.category}
          onChange={(e) => setParams((p) => ({ ...p, category: e.target.value, page: 1 }))}
          className="sm:max-w-[200px]"
          aria-label={t('staffDocuments.list.filterCategoryAriaLabel')}
        >
          <option value="">{t('staffDocuments.list.allCategories')}</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`staffDocuments.categoryLabels.${c}`, c)}
            </option>
          ))}
        </Select>
        <Button
          variant={params.expiring ? 'primary' : 'secondary'}
          onClick={() => setParams((p) => ({ ...p, expiring: !p.expiring, page: 1 }))}
        >
          {t('staffDocuments.list.expiringSoon')}
        </Button>
      </div>

      {isError ? (
        <EmptyState title={t('staffDocuments.list.couldNotLoad')} description={t('staffDocuments.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(d) => d._id}
            loading={isPending}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffDocuments.list.emptyTitleNoFilters') : t('staffDocuments.list.emptyTitleFiltered')}
                description={
                  noFilters
                    ? t('staffDocuments.list.emptyDescriptionNoFilters')
                    : t('common.tryClearingFilters')
                }
                action={noFilters && canWrite ? <Button onClick={() => setUploading(true)}>{t('staffDocuments.list.uploadDocument')}</Button> : null}
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                {t('common.showingRange', { from: (data.page - 1) * params.limit + 1, to: Math.min(data.page * params.limit, data.total), total: data.total })}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                  {t('common.previous')}
                </Button>
                <span className="tabular-nums">
                  {t('common.pageOf', { page: data.page, pages: data.pages })}
                </span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                  {t('common.next')}
                </Button>
              </span>
            </div>
          )}
        </>
      )}

      <DocumentUploadModal open={uploading} onClose={() => setUploading(false)} />
    </div>
  );
}
