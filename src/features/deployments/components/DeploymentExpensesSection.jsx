/**
 * DeploymentExpensesSection — real, per-Deployment expense tracking
 * (2026-09-24, Milestone 2 of the "Actual Performance" work — see
 * ActualPerformanceWidget.jsx's own doc comment for Milestone 1).
 * `Expense.deployment` already existed on the model before this — this is
 * the UI that was missing: a real place to see and add THIS deployment's
 * own expenses, instead of the generic Expenses page's buried, client-first
 * picker.
 *
 * Shows a real Revenue/Expenses/Net Profit summary scoped to Approved
 * timesheets only — deliberately NOT the same figure as the "Total Profit"
 * shown above in the Monthly Hours section (which sums every entry
 * regardless of status, an established, unchanged field this component
 * doesn't touch) — this one matches the dashboard's own Actual Performance
 * definition exactly, so "real revenue/expenses" means the same thing
 * everywhere in the app: only what's actually been approved, plus this
 * deployment's own linked expense ledger.
 *
 * Gated on the existing `expenses` Section Access (read to view this
 * section at all, write to add/edit) — the same grant that already governs
 * the standalone Expenses module, not a new permission tier.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listExpenses } from '../../expenses/expenses.api.js';
import ExpenseFormModal from '../../expenses/components/ExpenseFormModal.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatDate, formatMoney, cn } from '../../../lib/utils.js';

export default function DeploymentExpensesSection({ deployment }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('expenses'));
  const canWrite = Boolean(user.sectionAccessWrite?.includes('expenses'));
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit

  const { data, isPending, isError } = useQuery({
    queryKey: ['expenses', 'deployment', deployment._id],
    queryFn: () => listExpenses({ deployment: deployment._id, limit: 100 }),
    enabled: canRead,
  });

  if (!canRead) return null;

  const items = data?.items ?? [];
  const adHocTotal = items.reduce((sum, e) => sum + e.amount, 0);

  // Approved-only — see this file's own header comment for why this is a
  // deliberately different figure from `deployment.totalProfit` above.
  const approvedEntries = deployment.monthlyHours.filter((e) => e.status === 'Approved' && e.revenue != null);
  const approvedRevenue = approvedEntries.reduce((sum, e) => sum + e.revenue, 0);
  const approvedBuiltInExpenses = approvedEntries.reduce((sum, e) => sum + e.expenses, 0);
  const totalExpenses = approvedBuiltInExpenses + adHocTotal;
  const netProfit = approvedRevenue - totalExpenses;
  const hasAnyFigure = approvedEntries.length > 0 || items.length > 0;

  const lockedDeployment = {
    _id: deployment._id,
    client: deployment.client,
    label: `${deployment.workerName} — ${deployment.clientName}${deployment.site ? ` (${deployment.site})` : ''}`,
  };

  function openNew() {
    setEditing({});
  }
  function openEdit(expense) {
    setEditing(expense);
  }
  function closeModal() {
    setEditing(null);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.sectionExpenses')}</h2>
          <p className="mt-1 text-xs text-muted">{t('staffDeployments.detail.expensesHint')}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            {t('staffDeployments.detail.addExpense')}
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <p className="text-sm text-danger">{t('staffDeployments.detail.expensesLoadFailed')}</p>
      ) : (
        <>
          {hasAnyFigure && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.approvedRevenue')}</p>
                <p className="mt-1 text-lg font-bold text-text">{formatMoney(approvedRevenue)}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.expensesTotal')}</p>
                <p className="mt-1 text-lg font-bold text-text">{formatMoney(totalExpenses)}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.netProfitApproved')}</p>
                <p className={cn('mt-1 text-lg font-bold', netProfit >= 0 ? 'text-success' : 'text-danger')}>{formatMoney(netProfit)}</p>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              title={t('staffDeployments.detail.noExpensesYet')}
              description={t('staffDeployments.detail.noExpensesYetDescription')}
              action={
                canWrite && (
                  <Button variant="secondary" onClick={openNew}>
                    {t('staffDeployments.detail.addExpense')}
                  </Button>
                )
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {items.map((e) => (
                <div key={e._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{e.vendor}</p>
                    <p className="text-xs text-muted">
                      {e.category} · {formatDate(e.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-medium tabular-nums text-text">{formatMoney(e.amount)}</span>
                    {canWrite && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                        {t('common.edit')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ExpenseFormModal open={Boolean(editing)} editing={editing} onClose={closeModal} lockedDeployment={lockedDeployment} />
    </Card>
  );
}
