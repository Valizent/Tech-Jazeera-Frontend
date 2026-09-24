/**
 * ExpenseListPage — the company expense ledger (P2-M7), the other half of
 * profit alongside Invoices. Simple CRUD + filters + a monthly-totals
 * summary, same "list + modal" shape as HolidayListPage rather than
 * Invoice's full detail-page pattern — there is no sub-workflow here (no
 * payments/PDF), just records.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listExpenses, getExpenseSummary, deleteExpense, downloadExpenseReceipt } from '../expenses.api.js';
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
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ExpenseFormModal from '../components/ExpenseFormModal.jsx';

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

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteExpense(id),
    onSuccess: () => {
      toast.success(`Expense from ${toDelete.vendor} removed.`);
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    setEditing({});
  }
  function openEdit(expense) {
    setEditing(expense);
  }
  function closeModal() {
    setEditing(null);
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

      <ExpenseFormModal open={!!editing} editing={editing} onClose={closeModal} />

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
