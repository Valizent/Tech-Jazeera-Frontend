/**
 * AssetListPage — the company asset register (P3-D): vehicles, laptops,
 * phones, tools. Create/edit/retire and assign/return are
 * Admin/Manager/HR; everyone on staff can view.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { listEmployees } from '../../employees/employees.api.js';
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

export default function AssetListPage() {
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

  const { data: employeeData } = useQuery({
    queryKey: ['employees', { forAssets: true }],
    queryFn: () => listEmployees({ limit: 100, sortBy: 'fullName', sortOrder: 'asc' }),
    enabled: canWrite,
  });

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
      toast.success(editing?._id ? 'Asset updated.' : 'Asset added.');
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: s }) => setAssetStatus(id, s),
    onSuccess: () => {
      toast.success('Status updated.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAsset(id),
    onSuccess: () => {
      toast.success(`${toDelete.assetTag} deleted.`);
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
      toast.success(`${assigning.assetTag} assigned.`);
      setAssigning(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const returnFormHook = useForm({ resolver: zodResolver(returnFormSchema), defaultValues: emptyReturnForm });
  const returnMutation = useMutation({
    mutationFn: (values) => returnAsset(returning._id, values),
    onSuccess: () => {
      toast.success(`${returning.assetTag} returned.`);
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
      header: 'Asset',
      render: (a) => (
        <span className="font-medium text-text">
          {a.name}
          <span className="block text-xs font-normal text-muted">{a.assetTag}</span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (a) => a.category },
    {
      key: 'holder',
      header: 'Assigned to',
      render: (a) => (a.currentEmployee ? `${a.currentEmployee.fullName} (${a.currentEmployee.employeeId})` : '—'),
    },
    { key: 'status', header: 'Status', render: (a) => <Badge variant={ASSET_STATUS_VARIANT[a.status]}>{a.status}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => (
        <span className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setViewingHistory(a._id)}>
            History
          </Button>
          {canWrite && a.status === 'Available' && (
            <Button size="sm" variant="secondary" onClick={() => openAssign(a)}>
              Assign
            </Button>
          )}
          {canWrite && a.status === 'Assigned' && (
            <Button size="sm" variant="secondary" onClick={() => openReturn(a)}>
              Return
            </Button>
          )}
          {canWrite && a.status === 'Available' && (
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Maintenance' })}>
              Send to maintenance
            </Button>
          )}
          {canWrite && a.status === 'Maintenance' && (
            <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Available' })}>
              Mark available
            </Button>
          )}
          {canWrite && (a.status === 'Available' || a.status === 'Maintenance') && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
              Edit
            </Button>
          )}
          {canWrite && a.status !== 'Assigned' && a.status !== 'Retired' && (
            <Button size="sm" variant="danger-ghost" onClick={() => statusMutation.mutate({ id: a._id, status: 'Retired' })}>
              Retire
            </Button>
          )}
          {canDelete && a.status !== 'Assigned' && (
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(a)}>
              Delete
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Assets"
        description="Vehicles, laptops, phones, and tools — who has what."
        onBack={() => navigate(-1)}
        actions={canWrite && <Button onClick={openNew}>Add asset</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by category">
          <option value="">All categories</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState title="Could not load assets" description="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(a) => a._id}
          loading={isPending}
          emptyState={
            <EmptyState
              title="No assets yet"
              description={canWrite ? 'Add the company’s vehicles, laptops, and tools to start tracking them.' : 'Nothing has been added yet.'}
              action={canWrite && <Button variant="secondary" onClick={openNew}>Add asset</Button>}
            />
          }
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? 'Edit asset' : 'Add asset'}>
        <form onSubmit={assetForm.handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Asset tag *" placeholder="e.g. LAP-001" error={assetForm.formState.errors.assetTag?.message} {...assetForm.register('assetTag')} />
            <Select label="Category *" error={assetForm.formState.errors.category?.message} {...assetForm.register('category')}>
              <option value="">Choose…</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Name *" placeholder="e.g. Dell Latitude 5420" error={assetForm.formState.errors.name?.message} {...assetForm.register('name')} />
          <Input label="Purchase date" type="date" error={assetForm.formState.errors.purchaseDate?.message} {...assetForm.register('purchaseDate')} />
          <Textarea label="Notes" placeholder="Optional" error={assetForm.formState.errors.notes?.message} {...assetForm.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!assigning} onClose={() => setAssigning(null)} title={`Assign ${assigning?.assetTag ?? ''}`}>
        <form onSubmit={assignForm.handleSubmit((values) => assignMutation.mutate(values))} noValidate className="space-y-4">
          <Select label="Employee *" error={assignForm.formState.errors.employee?.message} {...assignForm.register('employee')}>
            <option value="">Select an employee…</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.fullName} ({e.employeeId})
              </option>
            ))}
          </Select>
          <Input label="Assigned on" type="date" error={assignForm.formState.errors.assignedAt?.message} {...assignForm.register('assignedAt')} />
          <Textarea label="Notes" placeholder="Optional" error={assignForm.formState.errors.notes?.message} {...assignForm.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssigning(null)} disabled={assignMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={assignMutation.isPending}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!returning} onClose={() => setReturning(null)} title={`Return ${returning?.assetTag ?? ''}`}>
        <form onSubmit={returnFormHook.handleSubmit((values) => returnMutation.mutate(values))} noValidate className="space-y-4">
          <p className="text-sm text-muted">
            Currently with {returning?.currentEmployee?.fullName}.
          </p>
          <Input label="Condition on return" placeholder="e.g. Good condition" error={returnFormHook.formState.errors.conditionNote?.message} {...returnFormHook.register('conditionNote')} />
          <Textarea label="Notes" placeholder="Optional" error={returnFormHook.formState.errors.notes?.message} {...returnFormHook.register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReturning(null)} disabled={returnMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={returnMutation.isPending}>
              Mark returned
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewingHistory} onClose={() => setViewingHistory(null)} title="Assignment history">
        {historyLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : history?.history?.length ? (
          <div className="divide-y divide-border">
            {history.history.map((h, i) => (
              <div key={i} className="py-3 text-sm">
                <p className="font-medium">{h.employeeName}</p>
                <p className="text-xs text-muted">
                  {formatDate(h.assignedAt)} – {h.returnedAt ? formatDate(h.returnedAt) : 'present'}
                </p>
                {h.conditionNote && <p className="mt-1 text-xs text-muted">Condition: {h.conditionNote}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No assignment history yet.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete asset?"
        message={`"${toDelete?.assetTag}" will be permanently removed. This is only possible for an asset with no assignment history.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
