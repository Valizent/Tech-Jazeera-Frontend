/**
 * Deployment register — every placement, current and historical, with status
 * and client filters. This is the read/overview screen; assigning happens on
 * a dedicated page, and transfer/end happen on the worker's profile (the
 * natural place to manage one worker's placement).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDeployments, deleteDeployment } from '../deployments.api.js';
import { listClients } from '../../clients/clients.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { DEPLOYMENT_STATUSES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const STATUS_VARIANT = { Active: 'success', Ended: 'default' };

export default function DeploymentListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canWrite = Boolean(user.sectionAccess?.includes('deploymentsManage'));
  // TEMPORARY — pre-production cleanup only. Remove this Admin-only delete
  // affordance (isAdmin, toDelete, deleteMutation, the actions column below,
  // and the ConfirmDialog at the bottom of this file) before going live —
  // see the note in deployments.api.js.
  const isAdmin = user.role === 'Admin';
  const [toDelete, setToDelete] = useState(null);

  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    status: '',
    client: '',
    sortOrder: 'desc',
  });

  // Clients for the filter dropdown (also confirms whether any client exists).
  const { data: clientData } = useQuery({
    queryKey: ['clients', 'all-for-filter'],
    queryFn: () => listClients({ limit: 100 }),
    staleTime: 60_000,
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', params],
    queryFn: () =>
      listDeployments({
        page: params.page,
        limit: params.limit,
        sortOrder: params.sortOrder,
        ...(params.status && { status: params.status }),
        ...(params.client && { client: params.client }),
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDeployment(id),
    onSuccess: () => {
      toast.success(t('staffDeployments.list.deletedToast'));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    {
      key: 'worker',
      header: t('staffDeployments.list.columns.worker'),
      render: (d) => (
        <Link to={`/employees/${d.worker?._id}`} className="font-medium text-text hover:text-primary">
          {d.worker?.fullName ?? t('staffDeployments.list.unknownWorker')}
          <span className="block text-xs font-normal text-muted">{d.worker?.employeeId}</span>
        </Link>
      ),
    },
    {
      key: 'client',
      header: t('staffDeployments.list.columns.clientSite'),
      render: (d) => (
        <span>
          {d.clientName}
          <span className="block text-xs text-muted">{d.site}</span>
        </span>
      ),
    },
    { key: 'shift', header: t('staffDeployments.list.columns.shift'), hideOnMobile: true, render: (d) => t(`staffDeployments.shiftLabels.${d.shift}`, d.shift) },
    {
      key: 'startDate',
      header: t('staffDeployments.list.columns.period'),
      render: (d) => (
        <span className="text-sm">
          {formatDate(d.startDate)}
          {d.endDate && <span className="text-muted"> → {formatDate(d.endDate)}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('staffDeployments.list.columns.status'),
      render: (d) => (
        <Badge variant={STATUS_VARIANT[d.status]}>
          {t(`common.status.${d.status}`, d.status)}
          {d.endReason ? ` · ${d.endReason}` : ''}
        </Badge>
      ),
    },
    // TEMPORARY — pre-production cleanup only, see the note above isAdmin.
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (d) => (
              <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(d)}>
                {t('common.delete')}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffDeployments.list.pageTitle')}
        description={t('staffDeployments.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={canWrite && <Button onClick={() => navigate('/deployments/new')}>{t('staffDeployments.list.assignWorker')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffDeployments.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {DEPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <Select
          value={params.client}
          onChange={(e) => setParams((p) => ({ ...p, client: e.target.value, page: 1 }))}
          className="sm:max-w-xs"
          aria-label={t('staffDeployments.list.filterClientAriaLabel')}
        >
          <option value="">{t('staffDeployments.list.allClients')}</option>
          {(clientData?.items ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState title={t('staffDeployments.list.couldNotLoad')} description={t('staffDeployments.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(d) => d._id}
            loading={isPending}
            onRowClick={(d) => d.worker?._id && navigate(`/employees/${d.worker._id}`)}
            emptyState={
              <EmptyState
                title={params.status || params.client ? t('staffDeployments.list.emptyTitleFiltered') : t('staffDeployments.list.emptyTitleNoFilters')}
                description={
                  params.status || params.client
                    ? t('common.tryClearingFilters')
                    : t('staffDeployments.list.emptyDescriptionNoFilters')
                }
                action={
                  !params.status && !params.client && canWrite ? (
                    <Button onClick={() => navigate('/deployments/new')}>{t('staffDeployments.list.assignWorker')}</Button>
                  ) : null
                }
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

      {/* TEMPORARY — pre-production cleanup only, see the note above isAdmin. */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffDeployments.list.deleteConfirmTitle')}
        message={t('staffDeployments.list.deleteConfirmMessage', {
          worker: toDelete?.worker?.fullName ?? '',
          client: toDelete?.clientName ?? '',
        })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
