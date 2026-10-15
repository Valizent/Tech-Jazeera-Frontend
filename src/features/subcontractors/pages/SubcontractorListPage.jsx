/**
 * SubcontractorListPage — the managed list of companies a Mobilisation can
 * be routed through. A row opens the subcontractor's profile; adding and
 * editing are full pages (the company profile is too large for a modal), the
 * same shape as the client list.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSubcontractors, deleteSubcontractor } from '../subcontractors.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { SUBCONTRACTOR_STATUSES, CLIENT_APPROVAL_STATUSES, CLIENT_APPROVAL_VARIANT } from '../../../lib/constants.js';
import { canDecideSubcontractor, canEditSubcontractor } from '../subcontractors.permissions.js';
import DecideSubcontractorModal from '../components/DecideSubcontractorModal.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import { MissingDetailsBadge } from '../../companyProfile/components/MissingDetails.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function SubcontractorListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canWrite = Boolean(user.sectionAccessWrite?.includes('subcontractorsManage'));
  const canDelete = user.role === 'Admin'; // delete is Admin only (2026-10-13)

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 20, search: '', status: '', approvalStatus: '' });
  const [toDelete, setToDelete] = useState(null);
  const [deciding, setDeciding] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['subcontractors', params],
    queryFn: () =>
      listSubcontractors({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
        ...(params.approvalStatus && { approvalStatus: params.approvalStatus }),
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubcontractor(id),
    onSuccess: () => {
      toast.success(t('staffSubcontractors.removedToast', { name: toDelete.name }));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    {
      key: 'name',
      header: t('staffSubcontractors.columns.name'),
      render: (s) => (
        <div>
          {s.name}
          <MissingDetailsBadge missing={s.missingDetails} />
        </div>
      ),
    },
    { key: 'contactPerson', header: t('staffSubcontractors.columns.contact'), hideOnMobile: true, render: (s) => s.contactPerson || '' },
    { key: 'phone', header: t('staffSubcontractors.columns.phone'), hideOnMobile: true, render: (s) => s.phone || '' },
    { key: 'email', header: t('staffSubcontractors.columns.email'), hideOnMobile: true, render: (s) => s.email || '' },
    {
      key: 'status',
      header: t('staffSubcontractors.columns.status'),
      render: (s) => <Badge variant={s.status === 'Active' ? 'success' : 'default'}>{t(`common.status.${s.status}`, s.status)}</Badge>,
    },
    {
      key: 'approvalStatus',
      header: t('staffSubcontractors.columns.approval'),
      render: (s) => {
        const approval = s.approvalStatus ?? 'Approved';
        return <Badge variant={CLIENT_APPROVAL_VARIANT[approval]}>{t(`common.status.${approval}`, approval)}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <span className="flex justify-end gap-2">
          <Button icon="eye" size="sm" variant="soft" onClick={() => navigate(`/subcontractors/${s._id}`)}>
            {t('common.view')}
          </Button>
          {canEditSubcontractor(user, s) && (
            <Button icon="pencil" size="sm" variant="soft" onClick={() => navigate(`/subcontractors/${s._id}/edit`)}>
              {t('common.edit')}
            </Button>
          )}
          {canDelete && (
            <Button icon="trash" size="sm" variant="danger-solid" onClick={() => setToDelete(s)}>
              {t('common.delete')}
            </Button>
          )}
          {canDecideSubcontractor(user, s) && (
            <Button size="sm" onClick={() => setDeciding(s)}>
              {t('staffSubcontractors.review')}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status && !params.approvalStatus;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffSubcontractors.pageTitle')}
        description={t('staffSubcontractors.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          canWrite && (
            <Button icon="plus" variant="success-solid" size="sm" onClick={() => navigate('/subcontractors/new')}>
              {t('staffSubcontractors.addSubcontractor')}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffSubcontractors.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffSubcontractors.searchAriaLabel')}
        />
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label={t('staffSubcontractors.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {SUBCONTRACTOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <Select
          value={params.approvalStatus}
          onChange={(e) => setParams((p) => ({ ...p, approvalStatus: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffSubcontractors.filterApprovalAriaLabel')}
        >
          <option value="">{t('staffSubcontractors.allApprovalStates')}</option>
          {CLIENT_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState
          title={t('staffSubcontractors.couldNotLoad')}
          description={t('staffSubcontractors.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(s) => s._id}
            loading={isPending}
            onRowClick={(s) => navigate(`/subcontractors/${s._id}`)}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffSubcontractors.emptyTitleNoFilters') : t('staffSubcontractors.emptyTitleFiltered')}
                description={
                  noFilters
                    ? canWrite
                      ? t('staffSubcontractors.emptyDescriptionManage')
                      : t('staffSubcontractors.emptyDescriptionView')
                    : t('common.tryClearingFilters')
                }
                action={
                  canWrite &&
                  noFilters && (
                    <Button icon="plus" variant="success-solid" onClick={() => navigate('/subcontractors/new')}>
                      {t('staffSubcontractors.addSubcontractor')}
                    </Button>
                  )
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
                <span className="tabular-nums">{t('common.pageOf', { page: data.page, pages: data.pages })}</span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                  {t('common.next')}
                </Button>
              </span>
            </div>
          )}
        </>
      )}

      <DecideSubcontractorModal subcontractor={deciding} onClose={() => setDeciding(null)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffSubcontractors.deleteConfirmTitle')}
        message={t('staffSubcontractors.deleteConfirmMessage', { name: toDelete?.name })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
