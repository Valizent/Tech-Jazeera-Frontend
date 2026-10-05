/**
 * DeploymentExpensesSection — per-Deployment expense tracking.
 * Lists all expenses entered against this deployment (fuel, accommodation,
 * etc.) with their receipt and edit actions.
 *
 * Gated on the existing `expenses` Section Access (read to view, write to
 * add/edit).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listExpenses, downloadExpenseReceipt } from '../../expenses/expenses.api.js';
import ExpenseFormModal from '../../expenses/components/ExpenseFormModal.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatDate, formatMoney } from '../../../lib/utils.js';

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

  const lockedDeployment = {
    _id: deployment._id,
    client: deployment.client,
    label: `${deployment.workerName} ${deployment.clientName}${deployment.site ? ` (${deployment.site})` : ''}`,
  };

  return (
    <Card className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('staffDeployments.detail.sectionExpenses')}
        </h2>
        {canWrite && (
          <Button size="sm" onClick={() => setEditing({})}>
            {t('staffDeployments.detail.addExpense')}
          </Button>
        )}
      </div>

      {/* Body */}
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? (
        <p className="text-sm text-danger">{t('staffDeployments.detail.expensesLoadFailed')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{t('staffDeployments.detail.noExpensesYet')}</p>
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
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-text">{formatMoney(e.amount)}</span>
                {e.receipt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadExpenseReceipt(e._id, e.receipt.originalName)}
                  >
                    📎 Receipt
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                    {t('common.edit')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExpenseFormModal
        open={Boolean(editing)}
        editing={editing}
        onClose={() => setEditing(null)}
        lockedDeployment={lockedDeployment}
      />
    </Card>
  );
}
