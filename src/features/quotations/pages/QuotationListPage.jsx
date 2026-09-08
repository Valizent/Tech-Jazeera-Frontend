/**
 * Quotations list — every quotation with status filter and search (by number
 * or client name). Same shape as the other list screens.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listQuotations } from '../quotations.api.js';
import { buildQuotationColumns } from '../components/quotationColumns.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { QUOTATION_STATUSES } from '../../../lib/constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function QuotationListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = Boolean(user.sectionAccess?.includes('quotationsManage'));

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 20, search: '', status: '' });

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['quotations', params],
    queryFn: () =>
      listQuotations({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
      }),
    placeholderData: keepPreviousData,
  });

  const columns = buildQuotationColumns({ showClient: true, t });
  const noFilters = !params.search && !params.status;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('staffQuotations.list.pageTitle')}
        description={t('staffQuotations.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={canWrite && <Button onClick={() => navigate('/quotations/new')}>{t('staffQuotations.list.newQuotation')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffQuotations.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffQuotations.list.searchAriaLabel')}
        />
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffQuotations.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState title={t('staffQuotations.list.couldNotLoad')} description={t('staffQuotations.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(q) => q._id}
            loading={isPending}
            onRowClick={(q) => navigate(`/quotations/${q._id}`)}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffQuotations.list.emptyTitleNoFilters') : t('staffQuotations.list.emptyTitleFiltered')}
                description={
                  noFilters ? t('staffQuotations.list.emptyDescriptionNoFilters') : t('common.tryClearingFilters')
                }
                action={noFilters && canWrite ? <Button onClick={() => navigate('/quotations/new')}>{t('staffQuotations.list.newQuotation')}</Button> : null}
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
    </div>
  );
}
