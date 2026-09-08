/**
 * SubcontractorListPage — the managed list of companies a Mobilisation can
 * be routed through. Same "list + modal" shape as ExpenseListPage/
 * HolidayListPage — no sub-workflow here, just records.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
} from '../subcontractors.api.js';
import { subcontractorFormSchema, emptySubcontractorForm, subcontractorToForm } from '../subcontractors.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { SUBCONTRACTOR_STATUSES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function SubcontractorListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canWrite = Boolean(user.sectionAccess?.includes('subcontractorsManage'));
  const canDelete = canWrite;

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 20, search: '', status: '' });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['subcontractors', params],
    queryFn: () =>
      listSubcontractors({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
      }),
    placeholderData: keepPreviousData,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(subcontractorFormSchema), defaultValues: emptySubcontractorForm });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcontractors'] });

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing?._id ? updateSubcontractor(editing._id, values) : createSubcontractor(values),
    onSuccess: () => {
      toast.success(editing?._id ? t('staffSubcontractors.updatedToast') : t('staffSubcontractors.addedToast'));
      closeModal();
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubcontractor(id),
    onSuccess: () => {
      toast.success(t('staffSubcontractors.removedToast', { name: toDelete.name }));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptySubcontractorForm);
    setEditing({});
  }
  function openEdit(subcontractor) {
    reset(subcontractorToForm(subcontractor));
    setEditing(subcontractor);
  }
  function closeModal() {
    setEditing(null);
  }

  const columns = [
    { key: 'name', header: t('staffSubcontractors.columns.name'), render: (s) => s.name },
    { key: 'contactPerson', header: t('staffSubcontractors.columns.contact'), hideOnMobile: true, render: (s) => s.contactPerson || '—' },
    { key: 'phone', header: t('staffSubcontractors.columns.phone'), hideOnMobile: true, render: (s) => s.phone || '—' },
    { key: 'email', header: t('staffSubcontractors.columns.email'), hideOnMobile: true, render: (s) => s.email || '—' },
    {
      key: 'status',
      header: t('staffSubcontractors.columns.status'),
      render: (s) => <Badge variant={s.status === 'Active' ? 'success' : 'default'}>{t(`common.status.${s.status}`, s.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <span className="flex justify-end gap-2">
          {canWrite && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
              {t('common.edit')}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(s)}>
              {t('common.delete')}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('staffSubcontractors.pageTitle')}
        description={t('staffSubcontractors.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          canWrite && (
            <Button size="sm" onClick={openNew}>
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
                action={canWrite && noFilters && <Button variant="secondary" onClick={openNew}>{t('staffSubcontractors.addSubcontractor')}</Button>}
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

      <Modal open={!!editing} onClose={closeModal} title={editing?._id ? t('staffSubcontractors.modalEditTitle') : t('staffSubcontractors.modalAddTitle')} size="lg">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('staffSubcontractors.form.name')} error={errors.name?.message} {...register('name')} />
            <Input label={t('staffSubcontractors.form.contactPerson')} error={errors.contactPerson?.message} {...register('contactPerson')} />
            <Input label={t('staffSubcontractors.form.phone')} error={errors.phone?.message} {...register('phone')} />
            <Input label={t('staffSubcontractors.form.email')} type="email" error={errors.email?.message} {...register('email')} />
            <Select label={t('staffSubcontractors.form.status')} error={errors.status?.message} {...register('status')}>
              {SUBCONTRACTOR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`common.status.${s}`, s)}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label={t('staffSubcontractors.form.notes')} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

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
