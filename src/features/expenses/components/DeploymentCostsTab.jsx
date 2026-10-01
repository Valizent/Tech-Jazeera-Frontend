/**
 * DeploymentCostsTab — a read-only, worker-scoped view of the real monthly
 * costs (FTA, Allowance, Deductions, Mob. Cost, OT Cost, commissions, Sub
 * Invoice) a Deployment already computes, surfaced here inside the Expenses
 * module per the user's own ask (2026-10-01) — "these expenses should be in
 * the expenses modal too, under that person's name, for each month."
 *
 * Deliberately NOTHING here is ever persisted as a new Expense document: the
 * company-wide Actual Performance dashboard (deployment.service.js's
 * getActualPerformanceSummary) already separately sums both a deployment's
 * own computed costs AND any real Expense ledger entries linked to it — a
 * real Expense record mirroring these same numbers would double-count
 * there. This tab only ever reads getDeployment live, same as the
 * Deployment's own detail page, and reuses that exact breakdown panel.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDeployments, getDeployment } from '../../deployments/deployments.api.js';
import { formatMoney } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import MonthlyEntryBreakdownPanel from '../../deployments/components/MonthlyEntryBreakdown.jsx';

/** Maps one of getDeployment's own monthlyHours entries (plus the parent
 *  deployment's rate fields) into the flat shape MonthlyEntryBreakdownPanel
 *  expects — the same shape Ready to Invoice/Paid Invoices already build,
 *  just assembled here from a single-deployment read instead of a list one. */
function toBreakdownRow(deployment, entry) {
  return {
    workerType: deployment.workerType,
    revenue: entry.revenue,
    expenses: entry.expenses,
    profit: entry.profit,
    breakdown: entry.breakdown,
    clientRate: deployment.mobilisation?.clientRate ?? null,
    clientCommission: deployment.mobilisation?.clientCommission ?? null,
    subcontractorRate: deployment.mobilisation?.subcontractorRate ?? null,
    subcontractorCommission: deployment.mobilisation?.subcontractorCommission ?? null,
    fta: deployment.mobilisation?.fta ?? null,
    allowance: deployment.mobilisation?.allowance ?? null,
    mobilisationCost: deployment.mobilisation?.mobilisationCost ?? null,
    deductionAmount: entry.deductionAmount ?? 0,
    supplierDeductionNote: entry.supplierDeductionNote ?? null,
    actualHours: entry.actualHours,
    otHours: entry.otHours,
    supplierHours: entry.supplierHours,
  };
}

export default function DeploymentCostsTab() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // One bulk fetch, filtered client-side by worker name — mirrors the
  // Deployments Overview modal's own established pattern for this exact
  // "search across everyone's placements" need (no server-side worker-name
  // search endpoint exists; `?worker=` there takes an Employee id, not text).
  const { data: deployments, isPending, isError } = useQuery({
    queryKey: ['deployments', 'all-for-cost-search'],
    queryFn: () => listDeployments({ limit: 5000 }),
    select: (d) => d.items,
  });

  const matches = useMemo(() => {
    if (!search.trim() || !deployments) return [];
    const q = search.trim().toLowerCase();
    return deployments.filter((d) => d.workerName?.toLowerCase().includes(q)).slice(0, 20);
  }, [search, deployments]);

  const { data: selected, isPending: selectedPending } = useQuery({
    queryKey: ['deployment', selectedId],
    queryFn: () => getDeployment(selectedId),
    enabled: Boolean(selectedId),
  });

  const monthsWithCost = useMemo(() => {
    if (!selected) return [];
    // A real cost only exists once computeMonthlyRevenueAndExpenses actually
    // ran for this entry — `expenses` is absent entirely for a viewer
    // without deploymentsHoursDecide (stripped server-side), same posture
    // as everywhere else this figure appears.
    return selected.monthlyHours.filter((e) => e.expenses != null).sort((a, b) => b.month.localeCompare(a.month));
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Input
          placeholder="Search by worker name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedId(null);
          }}
          aria-label="Search deployments by worker name"
        />
      </div>

      {isPending ? (
        <Skeleton className="h-10 w-full max-w-sm" />
      ) : isError ? (
        <EmptyState title="Could not load deployments" description="Check your connection and try again." />
      ) : search.trim() && !selectedId ? (
        matches.length === 0 ? (
          <p className="text-sm text-muted">No worker matches &quot;{search}&quot;.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {matches.map((d) => (
              <button
                key={d._id}
                type="button"
                onClick={() => setSelectedId(d._id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
              >
                <span>
                  <span className="block text-sm font-medium text-text">{d.workerName}</span>
                  <span className="block text-xs text-muted">{d.clientName}</span>
                </span>
                <Badge variant={d.status === 'Active' ? 'success' : 'default'}>{d.status}</Badge>
              </button>
            ))}
          </Card>
        )
      ) : null}

      {selectedId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">{selected?.workerName}</p>
              <p className="text-xs text-muted">{selected?.clientName}</p>
            </div>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSelectedId(null)}>
              Change worker
            </button>
          </div>

          {selectedPending ? (
            <Skeleton className="h-40 w-full" />
          ) : monthsWithCost.length === 0 ? (
            <EmptyState
              title="No costed months yet"
              description="Real costs appear here once this deployment has an Approved monthly-hours entry you have access to view."
            />
          ) : (
            monthsWithCost.map((entry) => (
              <div key={entry._id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{entry.month}</p>
                <MonthlyEntryBreakdownPanel row={toBreakdownRow(selected, entry)} formatMoney={formatMoney} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
