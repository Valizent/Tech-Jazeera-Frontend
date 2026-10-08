/**
 * AssetListPage — the company asset register (P3-D): vehicles, laptops,
 * phones, tools. Create/edit/retire and assign/return are
 * Admin/Manager/HR; everyone on staff can view.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  setAssetStatus,
  deleteAsset,
  assignAsset,
  returnAsset,
} from '../assets.api.js';
import { useEmployeePicker } from '../../../lib/useEmployeePicker.js';
import {
  assetFormSchema,
  emptyAssetForm,
  assetToForm,
  assignFormSchema,
  emptyAssignForm,
  returnFormSchema,
  emptyReturnForm,
} from '../assets.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { ASSET_CATEGORIES, ASSET_STATUSES, ASSET_STATUS_VARIANT, ASSET_DELETE_ROLES } from '../../../lib/constants.js';
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
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

export default function AssetListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canWrite = Boolean(user.sectionAccessWrite?.includes('assetsManage'));
  const canDelete = ASSET_DELETE_ROLES.includes(user.role);

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [assigning, setAssigning] = useState(null); // asset being assigned
  const [returning, setReturning] = useState(null); // asset being returned
  const [viewingHistory, setViewingHistory] = useState(null); // asset id
  const [toDelete, setToDelete] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['assets', { category, status }],
    queryFn: () => listAssets({ limit: 100, ...(category && { category }), ...(status && { status }) }),
  });

  const { data: employeeData, isError: employeesError } = useEmployeePicker({ enabled: canWrite });

  const { data: history, isPending: historyLoading } = useQuery({
    queryKey: ['assets', 'history', viewingHistory],
    queryFn: () => getAsset(viewingHistory),
    enabled: !!viewingHistory,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] });

  const assetForm = useForm({ resolver: zodResolver(assetFormSchema), defaultValues: emptyAssetForm });
  const saveMutation = useMutation({
    mutationFn: (values) => (editing?._id ? updateAsset(editing._id, values) : createAsset(values)),
    onSuccess: () => {
      toast.success(t(editing?._id ? 'staffAssets.updatedToast' : 'staffAssets.addedToast'));
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: s }) => setAssetStatus(id, s),
    onSuccess: () => {
      toast.success(t('staffAssets.statusUpdated'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAsset(id),
    onSuccess: () => {
      toast.success(t('staffAssets.deletedToast', { tag: toDelete.assetTag }));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToDelete(null);
    },
  });

  const assignForm = useForm({ resolver: zodResolver(assignFormSchema), defaultValues: emptyAssignForm });
  const assignMutation = useMutation({
    mutationFn: (values) => assignAsset(assigning._id, values),
    onSuccess: () => {
      toast.success(t('staffAssets.assignedToast', { tag: assigning.assetTag }));
      setAssigning(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const returnFormHook = useForm({ resolver: zodResolver(returnFormSchema), defaultValues: emptyReturnForm });
  const returnMutation = useMutation({
    mutationFn: (values) => returnAsset(returning._id, values),
    onSuccess: () => {
      toast.success(t('staffAssets.returnedToast', { tag: returning.assetTag }));
      setReturning(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    assetForm.reset(emptyAssetForm);
    setEditing({});
  }
  function openEdit(asset) {
    assetForm.reset(assetToForm(asset));
    setEditing(asset);
  }
  function openAssign(asset) {
    assignForm.reset(emptyAssignForm);
    setAssigning(asset);
  }
  function openReturn(asset) {
    returnFormHook.reset(emptyReturnForm);
    setReturning(asset);
  }

  const employees = employeeData?.items ?? [];

  const columns = [
    {
      key: 'assetTag',
      header: t('staffAssets.columns.asset'),
      render: (a) => (
        <span className="font-medium text-text">
          {a.name}
          <span className="block text-xs font-normal text-muted">{a.assetTag}</span>
        </span>
      ),
    },
    { key: 'category', header: t('staffAssets.category'), hideOnMobile: true, render: (a) => t(`staffAssets.categories.${a.category}`, a.category) },
    {
      key: 'holder',
      header: t('staffAssets.columns.assignedTo'),
      render: (a) => (a.currentEmployee ? `${a.currentEmployee.fullName} (${a.currentEmployee.employeeId})` : ''),
    },
    { key: 'status', header: t('staffAssets.columns.status'), render: (a) => <Badge variant={ASSET_STATUS_VARIANT[a.status]}>{t(`staffAssets.statuses.${a.status}`, a.status)}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => (
        <span className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setViewingHistory(a._id)}>
            {t('staffAssets.historyButton')}
          </Button>
          {canWrite && a.status === 'Available' && (
            <Button size="sm" variant="secondary" onClick={() => openAssign(a)}>
              {t('staffAssets.assign')}
            </Button>
          )}
          {canWrite && a.status === 'Assigned' && (
            <Button size="sm" variant="secondary" onClick={() => openReturn(a)}>
              {t('staffAssets.return')}
            </Button>
          )}
          {canWrite && a.status === 'Available' && (
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Maintenance' })}>
              {t('staffAssets.sendToMaintenance')}
            </Button>
          )}
          {canWrite && a.status === 'Maintenance' && (
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Available' })}>
              {t('staffAssets.markAvailable')}
            </Button>
          )}
          {canWrite && (a.status === 'Available' || a.status === 'Maintenance') && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
              {t('common.edit')}
            </Button>
          )}
          {canWrite && a.status !== 'Assigned' && a.status !== 'Retired' && (
            <Button size="sm" variant="danger-ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Retired' })}>
              {t('staffAssets.retire')}
            </Button>
          )}
          {canDelete && a.status !== 'Assigned' && (
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(a)}>
              {t('common.delete')}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffAssets.title')}
        description={t('staffAssets.description')}
        onBack={() => navigate(-1)}
        actions={canWrite && <Button onClick={openNew}>{t('staffAssets.addTitle')}</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:max-w-[180px]" aria-label={t('staffAssets.filterByCategory')}>
          <option value="">{t('staffAssets.allCategories')}</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`staffAssets.categories.${c}`, c)}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label={t('staffAssets.filterByStatus')}>
          <option value="">{t('common.allStatuses')}</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`staffAssets.statuses.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState title={t('staffAssets.couldNotLoad')} description={t('common.checkConnection')} action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(a) => a._id}
          loading={isPending}
          emptyState={
            <EmptyState
              title={t('staffAssets.emptyTitle')}
              description={t(canWrite ? 'staffAssets.emptyDescriptionWrite' : 'staffAssets.emptyDescriptionView')}
              action={canWrite && <Button variant="secondary" onClick={openNew}>{t('staffAssets.addTitle')}</Button>}
            />
          }
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t(editing?._id ? 'staffAssets.editTitle' : 'staffAssets.addTitle')}>
        <form onSubmit={assetForm.handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={`${t('staffAssets.assetTag')} *`} placeholder={t('staffAssets.tagPlaceholder')} error={assetForm.formState.errors.assetTag?.message} {...assetForm.register('assetTag')} />
            <Select label={`${t('staffAssets.category')} *`} error={assetForm.formState.errors.category?.message} {...assetForm.register('category')}>
              <option value="">{t('staffAssets.chooseCategory')}</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`staffAssets.categories.${c}`, c)}
                </option>
              ))}
            </Select>
          </div>
          <Input label={`${t('common.name')} *`} placeholder={t('staffAssets.namePlaceholder')} error={assetForm.formState.errors.name?.message} {...assetForm.register('name')} />
          <Input label={t('staffAssets.purchaseDate')} type="date" error={assetForm.formState.errors.purchaseDate?.message} {...assetForm.register('purchaseDate')} />
          <Textarea label={t('common.notes')} placeholder={t('common.optional')} error={assetForm.formState.errors.notes?.message} {...assetForm.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!assigning} onClose={() => setAssigning(null)} title={t('staffAssets.assignTitle', { tag: assigning?.assetTag ?? '' })}>
        <form onSubmit={assignForm.handleSubmit((values) => assignMutation.mutate(values))} noValidate className="space-y-4">
          <PickerLoadWarning failed={[{ label: t('staffAssets.employeesPicker'), isError: employeesError }]} />
          <Select label={`${t('staffAssets.employee')} *`} error={assignForm.formState.errors.employee?.message} {...assignForm.register('employee')}>
            <option value="">{t('staffAssets.selectEmployee')}</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.fullName} ({e.employeeId})
              </option>
            ))}
          </Select>
          <Input label={t('staffAssets.assignedOn')} type="date" error={assignForm.formState.errors.assignedAt?.message} {...assignForm.register('assignedAt')} />
          <Textarea label={t('common.notes')} placeholder={t('common.optional')} error={assignForm.formState.errors.notes?.message} {...assignForm.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssigning(null)} disabled={assignMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={assignMutation.isPending}>
              {t('staffAssets.assign')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!returning} onClose={() => setReturning(null)} title={t('staffAssets.returnTitle', { tag: returning?.assetTag ?? '' })}>
        <form onSubmit={returnFormHook.handleSubmit((values) => returnMutation.mutate(values))} noValidate className="space-y-4">
          <p className="text-sm text-muted">
            {t('staffAssets.currentlyWith', { name: returning?.currentEmployee?.fullName })}
          </p>
          <Input label={t('staffAssets.conditionOnReturn')} placeholder={t('staffAssets.conditionPlaceholder')} error={returnFormHook.formState.errors.conditionNote?.message} {...returnFormHook.register('conditionNote')} />
          <Textarea label={t('common.notes')} placeholder={t('common.optional')} error={returnFormHook.formState.errors.notes?.message} {...returnFormHook.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReturning(null)} disabled={returnMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={returnMutation.isPending}>
              {t('staffAssets.markReturned')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewingHistory} onClose={() => setViewingHistory(null)} title={t('staffAssets.history')}>
        {historyLoading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : history?.history?.length ? (
          <div className="divide-y divide-border">
            {history.history.map((h, i) => (
              <div key={i} className="py-3 text-sm">
                <p className="font-medium">{h.employeeName}</p>
                <p className="text-xs text-muted">
                  {formatDate(h.assignedAt)} – {h.returnedAt ? formatDate(h.returnedAt) : t('staffAssets.present')}
                </p>
                {h.conditionNote && <p className="mt-1 text-xs text-muted">{t('staffAssets.condition', { note: h.conditionNote })}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t('staffAssets.noHistory')}</p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffAssets.deleteTitle')}
        message={t('staffAssets.deleteMessage', { tag: toDelete?.assetTag })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
