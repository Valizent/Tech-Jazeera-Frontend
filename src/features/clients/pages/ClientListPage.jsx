/**
 * Client list — the customer register. Same shape as the employee list
 * (debounced search, status filter, sortable, paginated, role-gated) so the
 * two screens stay consistent and share the reusable Table.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listClients, deleteClient } from '../clients.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import {
  CLIENT_STATUSES,
  CLIENT_DELETE_ROLES,
  CLIENT_APPROVAL_STATUSES,
  CLIENT_APPROVAL_VARIANT,
} from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import DecideClientModal from '../components/DecideClientModal.jsx';
import { canDecideClient, canEditClient } from '../clients.permissions.js';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const STATUS_VARIANT = { Active: 'success', Inactive: 'default' };

export default function ClientListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canCreate = Boolean(user.sectionAccessWrite?.includes('clientsManage'));
  const canDelete = CLIENT_DELETE_ROLES.includes(user.role);
  const [deciding, setDeciding] = useState(null); // client pending Approve/Reject review

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    approvalStatus: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['clients', params],
    queryFn: () =>
      listClients({
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
        ...(params.approvalStatus && { approvalStatus: params.approvalStatus }),
      }),
    placeholderData: keepPreviousData,
    // Same reasoning as the Leave review queue: a new client submitted for
    // approval from another session has no way to reach this already-open
    // list otherwise.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const [toDelete, setToDelete] = useState(null);
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      toast.success(t('staffClients.list.deletedToast', { name: toDelete.companyName }));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    // The 409 "has assigned workers" guard surfaces here as a clear toast.
    onError: (error) => {
      toast.error(apiMessage(error));
      setToDelete(null);
    },
  });

  function toggleSort(key) {
    setParams((p) => ({
      ...p,
      sortBy: key,
      sortOrder: p.sortBy === key && p.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  const columns = [
    {
      key: 'companyName',
      header: t('staffClients.list.columns.company'),
      sortable: true,
      render: (c) => (
        <Link to={`/clients/${c._id}`} className="font-medium text-text hover:text-primary">
          {c.companyName}
          {c.contactPerson && (
            <span className="block text-xs font-normal text-muted">{c.contactPerson}</span>
          )}
        </Link>
      ),
    },
    { key: 'industry', header: t('staffClients.list.columns.industry'), render: (c) => c.industry || '—' },
    { key: 'phone', header: t('staffClients.list.columns.phone'), hideOnMobile: true, render: (c) => c.phone || '—' },
    {
      key: 'sites',
      header: t('staffClients.list.columns.sites'),
      render: (c) => (c.sites?.length ? <Badge variant="primary">{c.sites.length}</Badge> : '—'),
    },
    {
      key: 'status',
      header: t('staffClients.list.columns.status'),
      render: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{t(`common.status.${c.status}`, c.status)}</Badge>,
    },
    {
      key: 'approvalStatus',
      header: t('staffClients.list.columns.approval'),
      render: (c) => <Badge variant={CLIENT_APPROVAL_VARIANT[c.approvalStatus]}>{t(`common.status.${c.approvalStatus}`, c.approvalStatus)}</Badge>,
    },
    {
      key: 'createdBy',
      header: t('staffClients.list.columns.addedBy'),
      hideOnMobile: true,
      render: (c) =>
        c.createdBy ? (
          <span>
            {c.createdBy.name}
            {c.createdBy.role === 'Coordinator' && (
              <Badge variant="primary" className="ml-1.5">
                {t('staffClients.list.coordinatorBadge')}
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/clients/${c._id}`)}>
            {t('common.view')}
          </Button>
          {canEditClient(user, c) && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/clients/${c._id}/edit`)}>
              {t('common.edit')}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(c)}>
              {t('common.delete')}
            </Button>
          )}
          {canDecideClient(user, c) && (
            <Button size="sm" onClick={() => setDeciding(c)}>
              {t('staffClients.list.review')}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status && !params.approvalStatus;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffClients.list.pageTitle')}
        description={t('staffClients.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={canCreate && <Button onClick={() => navigate('/clients/new')}>{t('staffClients.list.addClient')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffClients.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffClients.list.searchAriaLabel')}
        />
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffClients.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <Select
          value={params.approvalStatus}
          onChange={(e) => setParams((p) => ({ ...p, approvalStatus: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffClients.list.filterApprovalAriaLabel')}
        >
          <option value="">{t('staffClients.list.allApprovalStates')}</option>
          {CLIENT_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState
          title={t('staffClients.list.couldNotLoad')}
          description={t('staffClients.list.couldNotLoadDescription')}
          action={
            <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(c) => c._id}
            loading={isPending}
            sortBy={params.sortBy}
            sortOrder={params.sortOrder}
            onSort={toggleSort}
            onRowClick={(c) => navigate(`/clients/${c._id}`)}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffClients.list.emptyTitleNoFilters') : t('staffClients.list.emptyTitleFiltered')}
                description={
                  noFilters
                    ? t('staffClients.list.emptyDescriptionNoFilters')
                    : t('common.tryClearingFilters')
                }
                action={
                  noFilters && canCreate ? (
                    <Button onClick={() => navigate('/clients/new')}>{t('staffClients.list.addClient')}</Button>
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffClients.list.deleteConfirmTitle')}
        message={t('staffClients.list.deleteConfirmMessage', { name: toDelete?.companyName })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />

      <DecideClientModal client={deciding} onClose={() => setDeciding(null)} />
    </div>
  );
}
