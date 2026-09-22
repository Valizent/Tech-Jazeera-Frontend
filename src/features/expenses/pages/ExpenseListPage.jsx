/**
 * ExpenseListPage — the company expense ledger (P2-M7), the other half of
 * profit alongside Invoices. Simple CRUD + filters + a monthly-totals
 * summary, same "list + modal" shape as HolidayListPage rather than
 * Invoice's full detail-page pattern — there is no sub-workflow here (no
 * payments/PDF), just records.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  listExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  downloadExpenseReceipt,
} from '../expenses.api.js';
import { expenseFormSchema, emptyExpenseForm, expenseToForm } from '../expenses.schema.js';
import { useClientPicker } from '../../../lib/useClientPicker.js';
import { listDeployments } from '../../deployments/deployments.api.js';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import { EXPENSE_CATEGORIES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const RECEIPT_MAX_MB = 10;

function SummaryBar() {
  const { data, isPending } = useQuery({
    queryKey: ['expenses', 'summary'],
    queryFn: () => getExpenseSummary({}),
  });

  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;

  const monthLabel = new Date(data.from).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recorded in {monthLabel}</h2>
        <span className="text-2xl font-semibold tabular-nums text-text">{formatMoney(data.total)}</span>
      </div>
      {data.byCategory.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {data.byCategory.map((c) => (
            <span key={c.category} className="flex items-center gap-1.5 text-muted">
              <span className="text-text">{c.category}</span>
              <span className="tabular-nums">{formatMoney(c.total)}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ExpenseListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // 'expenses' has a real Read/Write split — reaching this page only
  // implies Read (2026-09-14 fix, a real QA-audit-found gap: Add/Edit/
  // Delete were all unconditional, never checking write access at all).
  const canWrite = Boolean(user.sectionAccessWrite?.includes('expenses'));

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 20, search: '', category: '', from: '', to: '' });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [toDelete, setToDelete] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['expenses', params],
    queryFn: () =>
      listExpenses({
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.category && { category: params.category }),
        ...(params.from && { from: params.from }),
        ...(params.to && { to: params.to }),
      }),
    placeholderData: keepPreviousData,
  });

  // Shared with DocumentUploadModal's own client picker (2026-09-22, a real
  // QA-audit finding — P9: identical endpoint/params previously fetched
  // under two separate cache keys).
  const { data: clientData, isError: clientsError } = useClientPicker({ enabled: Boolean(editing) });
  const clients = clientData?.items ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyExpenseForm });

  const selectedClient = useWatch({ control, name: 'client' });

  const { data: deploymentData, isError: deploymentsError } = useQuery({
    queryKey: ['deployments', 'for-expense', selectedClient],
    queryFn: () => listDeployments({ client: selectedClient, limit: 100 }),
    enabled: Boolean(editing) && Boolean(selectedClient),
  });
  const deployments = deploymentData?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  function resetFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(`File is too large (maximum ${RECEIPT_MAX_MB} MB).`);
      e.target.value = '';
      return;
    }
    setPendingFile(file);
  }

  const saveMutation = useMutation({
    mutationFn: (values) => {
      // Update sends the full form (like Holidays) — an untouched optional
      // field just re-affirms its current value; an emptied one (client set
      // back to "No client link") clears it, since the key stays present in
      // the JSON body either way (see expense.validation.js's emptyToUndef).
      if (editing?._id) return updateExpense(editing._id, values);
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (value) fd.append(key, value); // skip empty optional fields entirely
      }
      if (pendingFile) fd.append('file', pendingFile);
      return createExpense(fd);
    },
    onSuccess: () => {
      toast.success(editing?._id ? 'Expense updated.' : 'Expense recorded.');
      closeModal();
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteExpense(id),
    onSuccess: () => {
      toast.success(`Expense from ${toDelete.vendor} removed.`);
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyExpenseForm);
    resetFile();
    setEditing({});
  }
  function openEdit(expense) {
    reset(expenseToForm(expense));
    resetFile();
    setEditing(expense);
  }
  function closeModal() {
    setEditing(null);
    resetFile();
  }

  async function handleDownload(expense) {
    try {
      await downloadExpenseReceipt(expense._id, expense.receipt.originalName);
    } catch (error) {
      toast.error(apiMessage(error, 'Could not download the receipt.'));
    }
  }

  const columns = [
    { key: 'date', header: 'Date', render: (e) => formatDate(e.date) },
    { key: 'category', header: 'Category', render: (e) => e.category },
    { key: 'vendor', header: 'Vendor', render: (e) => e.vendor },
    { key: 'client', header: 'Client', hideOnMobile: true, render: (e) => e.clientName ?? '—' },
    { key: 'amount', header: 'Amount', className: 'text-right', render: (e) => <span className="tabular-nums">{formatMoney(e.amount)}</span> },
    {
      key: 'receipt',
      header: 'Receipt',
      hideOnMobile: true,
      render: (e) =>
        e.receipt ? (
          <Button size="sm" variant="ghost" onClick={() => handleDownload(e)}>
            Download
          </Button>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (e) =>
        canWrite ? (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
              Edit
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(e)}>
              Delete
            </Button>
          </span>
        ) : null,
    },
  ];

  const noFilters = !params.search && !params.category && !params.from && !params.to;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Expenses"
        description="Company costs — rent, fuel, purchases, utilities — the other half of profit alongside invoices."
        onBack={() => navigate(-1)}
        actions={
          !isError &&
          canWrite && (
            <Button size="sm" onClick={openNew}>
              Add expense
            </Button>
          )
        }
      />

      <SummaryBar />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder="Search vendor or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label="Search expenses"
        />
        <Select
          value={params.category}
          onChange={(e) => setParams((p) => ({ ...p, category: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={params.from}
          onChange={(e) => setParams((p) => ({ ...p, from: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label="From date"
        />
        <Input
          type="date"
          value={params.to}
          onChange={(e) => setParams((p) => ({ ...p, to: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label="To date"
        />
      </div>

      {isError ? (
        <EmptyState
          title="You don't have access to this page"
          description={apiMessage(error) || 'Expenses can only be opened by whoever an Admin has granted access.'}
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(e) => e._id}
            loading={isPending}
            emptyState={
              <EmptyState
                title={noFilters ? 'No expenses recorded yet' : 'No expenses match'}
                description={noFilters ? 'Record your first company expense above.' : 'Try clearing the search or filters.'}
                action={noFilters && canWrite && <Button variant="secondary" onClick={openNew}>Add expense</Button>}
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                Showing {(data.page - 1) * params.limit + 1}–{Math.min(data.page * params.limit, data.total)} of {data.total}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                  Previous
                </Button>
                <span className="tabular-nums">
                  {data.page} / {data.pages}
                </span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                  Next
                </Button>
              </span>
            </div>
          )}
        </>
      )}

      <Modal open={!!editing} onClose={closeModal} title={editing?._id ? 'Edit expense' : 'Add expense'} size="lg">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <PickerLoadWarning
            failed={[
              { label: 'clients', isError: clientsError },
              { label: 'deployments', isError: Boolean(selectedClient) && deploymentsError },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Date *" type="date" error={errors.date?.message} {...register('date')} />
            <Select label="Category *" error={errors.category?.message} {...register('category')}>
              <option value="">Choose a category…</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input label="Vendor *" placeholder="e.g. ACME Trading Est." error={errors.vendor?.message} {...register('vendor')} />
            <Input label="Amount (SAR) *" type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
            <Select label="Client (optional)" error={errors.client?.message} {...register('client')}>
              <option value="">No client link</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
            <Select label="Deployment (optional)" disabled={!selectedClient} error={errors.deployment?.message} {...register('deployment')}>
              <option value="">{selectedClient ? 'No deployment link' : 'Select a client first'}</option>
              {deployments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.site} — {d.worker?.fullName} ({d.status})
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Notes" placeholder="Optional" error={errors.notes?.message} {...register('notes')} />

          {editing?._id ? (
            editing.receipt && (
              <p className="text-sm text-muted">
                Receipt: {editing.receipt.originalName} — attached at entry, cannot be changed here.
              </p>
            )
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Receipt (optional)</label>
              <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  {pendingFile ? 'Change file' : 'Choose file'}
                </Button>
                {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
              </div>
              <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, or WEBP — up to {RECEIPT_MAX_MB} MB.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete expense?"
        message={`The ${toDelete?.category} expense from ${toDelete?.vendor} (${toDelete ? formatMoney(toDelete.amount) : ''}) will be permanently removed.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
