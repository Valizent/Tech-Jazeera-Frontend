/**
 * ExpenseListPage — the company expense ledger (P2-M7), the other half of
 * profit alongside Invoices. Simple CRUD + filters + a monthly-totals
 * summary, same "list + modal" shape as HolidayListPage rather than
 * Invoice's full detail-page pattern — there is no sub-workflow here (no
 * payments/PDF), just records.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
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
import DeploymentCostsTab from '../components/DeploymentCostsTab.jsx';
import Tabs, { useTabParam } from '../../../components/ui/Tabs.jsx';

function SummaryBar() {
  const { t, i18n } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: ['expenses', 'summary'],
    queryFn: () => getExpenseSummary({}),
  });

  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;

  const monthLabel = new Date(data.from).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffExpenses.summaryBar.recordedIn', { month: monthLabel })}</h2>
        <span className="text-2xl font-semibold tabular-nums text-text">{formatMoney(data.total)}</span>
      </div>
      {data.byCategory.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {data.byCategory.map((c) => (
            <span key={c.category} className="flex items-center gap-1.5 text-muted">
              <span className="text-text">{t(`staffExpenses.categoryLabels.${c.category}`)}</span>
              <span className="tabular-nums">{formatMoney(c.total)}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ExpenseListPage() {
  const { t } = useTranslation();
  const L = (key, options) => t(`staffExpenses.list.${key}`, options);
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
    const timer = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
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
      toast.success(L('removedToast', { vendor: toDelete.vendor }));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => {
      console.error('[expenses] delete failed', error);
      toast.error(apiMessage(error));
    },
  });

  // Recurring expenses (rent, subscriptions, ...) get re-typed every month —
  // deliberately kept a one-click, human-confirmed prefill rather than a
  // real recurrence scheduler: nothing about money should be created
  // unattended (same posture as every other financial mutation in this
  // app). No schema change needed — it's just the same form, pre-filled.
  const [duplicateFrom, setDuplicateFrom] = useState(null);

  function openNew() {
    setDuplicateFrom(null);
    setEditing({});
  }
  function openEdit(expense) {
    setDuplicateFrom(null);
    setEditing(expense);
  }
  function openDuplicate(expense) {
    setDuplicateFrom(expense);
    setEditing({});
  }
  function closeModal() {
    setEditing(null);
    setDuplicateFrom(null);
  }

  async function handleDownload(expense) {
    try {
      await downloadExpenseReceipt(expense._id, expense.receipt.originalName);
    } catch (error) {
      toast.error(apiMessage(error, L('receiptDownloadFailedToast')));
    }
  }

  const columns = [
    { key: 'date', header: L('columns.date'), render: (e) => formatDate(e.date) },
    {
      key: 'category',
      header: L('columns.category'),
      render: (e) => (
        <span className="flex items-center gap-1.5">
          {t(`staffExpenses.categoryLabels.${e.category}`)}
          {e.sourceReimbursement && (
            <Link
              to={`/financial-requests?tab=reimbursements&claim=${e.sourceReimbursement}`}
              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary hover:bg-primary/20"
              title={L('claimLinkTitle')}
            >
              {L('claimLink')}
            </Link>
          )}
        </span>
      ),
    },
    { key: 'vendor', header: L('columns.vendor'), render: (e) => e.vendor },
    { key: 'client', header: L('columns.client'), hideOnMobile: true, render: (e) => e.clientName ?? '' },
    { key: 'amount', header: L('columns.amount'), className: 'text-end', render: (e) => <span className="tabular-nums">{formatMoney(e.amount)}</span> },
    {
      key: 'receipt',
      header: L('columns.receipt'),
      hideOnMobile: true,
      render: (e) =>
        e.receipt ? (
          <Button size="sm" variant="ghost" onClick={() => handleDownload(e)}>
            {t('common.download')}
          </Button>
        ) : (
          <span className="text-muted"></span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (e) =>
        canWrite ? (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openDuplicate(e)}>
              {L('duplicate')}
            </Button>
            {!e.sourceReimbursement && (
              <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(e)}>
                {t('common.delete')}
              </Button>
            )}
          </span>
        ) : null,
    },
  ];

  const noFilters = !params.search && !params.category && !params.from && !params.to;

  const tabs = [
    {
      key: 'ledger',
      label: L('tabs.ledger'),
      content: (
        <>
          <SummaryBar />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={L('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={L('searchAriaLabel')}
        />
        <Select
          value={params.category}
          onChange={(e) => setParams((p) => ({ ...p, category: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={L('filterCategoryAriaLabel')}
        >
          <option value="">{L('allCategories')}</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`staffExpenses.categoryLabels.${c}`)}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={params.from}
          onChange={(e) => setParams((p) => ({ ...p, from: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label={L('fromDateAriaLabel')}
        />
        <Input
          type="date"
          value={params.to}
          onChange={(e) => setParams((p) => ({ ...p, to: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
          aria-label={L('toDateAriaLabel')}
        />
      </div>

      {isError ? (
        <EmptyState
          title={L('noAccessTitle')}
          description={apiMessage(error) || L('noAccessDefaultDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
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
                title={noFilters ? L('emptyTitleNoFilters') : L('emptyTitleFiltered')}
                description={noFilters ? L('emptyDescriptionNoFilters') : t('common.tryClearingFilters')}
                action={noFilters && canWrite && <Button variant="secondary" onClick={openNew}>{L('addExpense')}</Button>}
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
        </>
      ),
    },
    {
      // Read-only, scoped by worker/deployment (2026-10-01, the user's own
      // choice) — never a new Expense record, see DeploymentCostsTab's own
      // doc comment for why.
      key: 'deployment-costs',
      label: L('tabs.deploymentCosts'),
      content: <DeploymentCostsTab />,
    },
  ];
  const [tab, setTab] = useTabParam(tabs, 'ledger');

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={L('pageTitle')}
        description={L('pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          tab === 'ledger' &&
          !isError &&
          canWrite && (
            <Button size="sm" onClick={openNew}>
              {L('addExpense')}
            </Button>
          )
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <ExpenseFormModal open={!!editing} editing={editing} duplicateFrom={duplicateFrom} onClose={closeModal} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={L('deleteConfirmTitle')}
        message={toDelete ? L('deleteConfirmMessage', { category: t(`staffExpenses.categoryLabels.${toDelete.category}`), vendor: toDelete.vendor, amount: formatMoney(toDelete.amount) }) : ''}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
