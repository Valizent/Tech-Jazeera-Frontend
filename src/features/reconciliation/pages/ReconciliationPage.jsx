/**
 * ReconciliationPage — a standing, read-only integrity report (the QA
 * audit's own suggestion #6: "add reconciliation checks for ledger
 * totals, finalized payroll, and deployments missing from approved
 * mobilisations"). Gated by the real 'reconciliation' Section Access
 * grant, same shape as the Security Log — no write action exists here;
 * every finding links to the real record for a human to decide what to
 * do about it.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getReconciliationReport } from '../reconciliation.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDateTime } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const SEVERITY_VARIANT = { high: 'danger', medium: 'warning', low: 'default' };

const CATEGORY_LABELS = {
  orphanedMobilisation: 'Mobilisation with no Deployment',
  doubleBookedWorker: 'Worker placed at two clients at once',
  invoiceLedgerMismatch: 'Invoice payment ledger mismatch',
  advanceOverRepaid: 'Salary advance over-repaid',
  advanceStatusMismatch: 'Salary advance status mismatch',
  payrollRunMismatch: 'Payroll run total mismatch',
};

export default function ReconciliationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('reconciliation'));

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: getReconciliationReport,
    enabled: canRead,
  });

  if (!canRead) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Data Reconciliation"
        description="A standing integrity check: ledger totals that no longer add up, an approved mobilisation with no deployment, a worker placed two places at once."
        onBack={() => navigate(-1)}
        actions={
          <Button variant="secondary" onClick={() => refetch()} isLoading={isFetching}>
            Re-run now
          </Button>
        }
      />

      <Card>
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <EmptyState
            title="Could not load the reconciliation report"
            description={apiMessage(error)}
            action={
              <Button variant="secondary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : data.total === 0 ? (
          <EmptyState
            title="Everything reconciles"
            description={`No integrity issues found as of ${formatDateTime(data.checkedAt)}.`}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {data.total} issue{data.total === 1 ? '' : 's'} found, as of {formatDateTime(data.checkedAt)}.
            </p>
            <div className="divide-y divide-border">
              {data.findings.map((finding, i) => (
                <button
                  key={`${finding.category}-${finding.targetId}-${i}`}
                  type="button"
                  onClick={() => navigate(finding.url)}
                  className="flex w-full flex-col gap-1.5 py-3 text-left transition-colors hover:bg-border/20"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[finding.severity] ?? 'default'}>{finding.severity}</Badge>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {CATEGORY_LABELS[finding.category] ?? finding.category}
                    </span>
                  </div>
                  <p className="text-sm text-text">{finding.summary}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
