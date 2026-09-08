/**
 * MobilisationListPage — every mobilisation this viewer can see (M1: their
 * own, as coordinator; Admin sees all). Row-clickable to edit, same "detail
 * view" until a proper detail page lands in M2/M3.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listMobilisations, downloadMobilisationsExport } from '../mobilisations.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { MOBILISATION_STATUSES, MOBILISATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function MobilisationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 20, search: '', status: '' });

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['mobilisations', params],
    queryFn: () =>
      listMobilisations({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
      }),
    placeholderData: keepPreviousData,
    // Same reasoning as the Leave review queue: a coordinator submitting or
    // a Marketing Manager deciding a mobilisation from another session has
    // no way to reach this already-open list otherwise.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadMobilisationsExport({
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
      }),
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    { key: 'serialNumber', header: t('staffMobilisations.list.columns.serialNumber'), render: (m) => m.serialNumber },
    { key: 'workerName', header: t('staffMobilisations.list.columns.worker'), render: (m) => m.workerName },
    { key: 'jobTitle', header: t('staffMobilisations.list.columns.jobTitle'), hideOnMobile: true, render: (m) => m.jobTitle },
    { key: 'clientName', header: t('staffMobilisations.list.columns.client'), render: (m) => m.clientName },
    { key: 'mobilisationDate', header: t('staffMobilisations.list.columns.mobilisationDate'), hideOnMobile: true, render: (m) => formatDate(m.mobilisationDate) },
    {
      key: 'status',
      header: t('staffMobilisations.list.columns.status'),
      render: (m) => <Badge variant={MOBILISATION_STATUS_VARIANT[m.status]}>{t(`common.status.${m.status}`, m.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/mobilisations/${m._id}`)}>
            {t('common.view')}
          </Button>
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('staffMobilisations.list.pageTitle')}
        description={t('staffMobilisations.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              isLoading={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {t('staffMobilisations.list.exportExcel')}
            </Button>
            <Button size="sm" onClick={() => navigate('/mobilisations/new')}>
              {t('staffMobilisations.list.newMobilisation')}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffMobilisations.list.searchPlaceholderWithSerial')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffMobilisations.list.searchAriaLabel')}
        />
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffMobilisations.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {MOBILISATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState
          title={t('staffMobilisations.list.couldNotLoad')}
          description={t('staffMobilisations.list.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(m) => m._id}
            loading={isPending}
            onRowClick={(m) => navigate(`/mobilisations/${m._id}`)}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffMobilisations.list.emptyTitleNoFilters') : t('staffMobilisations.list.emptyTitleFiltered')}
                description={noFilters ? t('staffMobilisations.list.emptyDescriptionNoFilters') : t('common.tryClearingFilters')}
                action={noFilters && <Button variant="secondary" onClick={() => navigate('/mobilisations/new')}>{t('staffMobilisations.list.newMobilisation')}</Button>}
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
