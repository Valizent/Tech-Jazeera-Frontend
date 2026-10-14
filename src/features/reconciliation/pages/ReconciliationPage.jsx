/**
 * ReconciliationPage — a standing, read-only integrity report (the QA
 * audit's own suggestion #6: "add reconciliation checks for ledger
 * totals, finalized payroll, and deployments missing from approved
 * mobilisations"). Gated by the real 'reconciliation' Section Access
 * grant, same shape as the Security Log. Every finding links to the real
 * record for a human to decide what to do about it; the one thing that can
 * be done from here (Admin only, 2026-10-14) is deleting an approved
 * mobilisation that never got its deployment, since nothing depends on it.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getReconciliationReport } from '../reconciliation.api.js';
import { deleteMobilisation } from '../../mobilisations/mobilisations.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, formatDateTime } from '../../../lib/utils.js';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const SEVERITY_VARIANT = { high: 'danger', medium: 'warning', low: 'default' };

const CATEGORY_LABELS = {
  orphanedMobilisation: 'Mobilisation with no Deployment',
  doubleBookedWorker: 'Employee placed at two clients at once',
  advanceOverRepaid: 'Salary advance over-repaid',
  advanceStatusMismatch: 'Salary advance status mismatch',
  assetMultipleHolders: 'Asset held by more than one person',
  assetHolderMismatch: 'Asset status disagrees with its assignment',
  assetAssignedWithoutHolder: 'Asset marked assigned but nobody holds it',
  multipleMobilisedStages: 'More than one fully-mobilised requirement stage',
  requirementMissingStage: 'Requirement in a stage that no longer exists',
  clientPaymentInvalid: 'Client payment with an invalid amount or client',
  subcontractorPaymentInvalid: 'Subcontractor payment with an invalid amount or subcontractor',
  subcontractorInvoiceIncomplete: 'Subcontractor invoice missing its number or date',
};

export default function ReconciliationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('reconciliation'));
  const queryClient = useQueryClient();
  const toast = useToast();
  const [toDelete, setToDelete] = useState(null);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: getReconciliationReport,
    enabled: canRead,
  });

  const deleteMutation = useMutation({
    mutationFn: (finding) => deleteMobilisation(finding.targetId),
    onSuccess: () => {
      toast.success('Mobilisation deleted.');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
    },
    onError: (err) => {
      console.error('[reconciliation] deleting a mobilisation failed', err);
      setToDelete(null);
      toast.error(apiMessage(err));
    },
  });

  if (!canRead) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Data Reconciliation"
        description="A standing integrity check: ledger totals that no longer add up, an approved mobilisation with no deployment, an employee placed two places at once."
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
                <div
                  key={`${finding.category}-${finding.targetId}-${i}`}
                  className="flex items-center justify-between gap-3 transition-colors hover:bg-border/20"
                >
                  <button type="button" onClick={() => navigate(finding.url)} className="flex min-w-0 flex-1 flex-col gap-1.5 py-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[finding.severity] ?? 'default'}>{finding.severity}</Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted">
                        {CATEGORY_LABELS[finding.category] ?? finding.category}
                      </span>
                    </div>
                    <p className="text-sm text-text">{finding.summary}</p>
                  </button>
                  {user.role === 'Admin' && finding.category === 'orphanedMobilisation' && (
                    <Button size="sm" variant="danger" onClick={() => setToDelete(finding)}>
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this mobilisation?"
        message={`${toDelete?.summary ?? ''} It was approved but never got a deployment, so nothing else depends on it. Deleting it removes it for good.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
