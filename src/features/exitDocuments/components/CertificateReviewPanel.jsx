/**
 * CertificateReviewPanel — the staff review queue for certificate requests:
 * approve/reject (per-row canDecideCurrentStep, via the Configurable
 * Approval Hierarchy engine — same as Leave), download the generated PDF
 * (letter types only), then mark issued once handed over (or, for the
 * attestation type, once the physical stamping is complete). Marking issued
 * stays a separate, static-role check (EXIT_DOCUMENTS_ISSUE_ROLES).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCertificates, decideCertificate, markCertificateIssued, downloadCertificatePdf } from '../certificates.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import {
  CERTIFICATE_STATUSES,
  CERTIFICATE_STATUS_VARIANT,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES_WITH_PDF,
  EXIT_DOCUMENTS_ISSUE_ROLES,
} from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function CertificateReviewPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canIssue = EXIT_DOCUMENTS_ISSUE_ROLES.includes(user.role);
  const [status, setStatus] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['exit-documents', 'certificates', { status }],
    queryFn: () => listCertificates({ limit: 50, ...(status && { status }) }),
    // Same reasoning as the Leave review queue: a submission from another
    // session has no way to reach this already-open queue otherwise. 20s,
    // not 10s (2026-09-22, a real QA-audit finding — P1) — see
    // LeavePage.jsx's own comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exit-documents', 'certificates'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideCertificate(id, { status: decision }),
    onSuccess: (request) => {
      toast.success(`Request ${request.status.toLowerCase()}.`);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const issueMutation = useMutation({
    mutationFn: (id) => markCertificateIssued(id),
    onSuccess: () => {
      toast.success('Marked as issued.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function handleDownload(request) {
    setDownloadingId(request._id);
    try {
      await downloadCertificatePdf(request._id, `${request.type}-${request.employee?.employeeId}.pdf`);
    } catch (error) {
      toast.error(apiMessage(error, 'Could not generate the PDF.'));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Certificate requests</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {CERTIFICATE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <EmptyState title="Could not load requests" description="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No certificate requests" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((c) => {
            const hasPdf = CERTIFICATE_TYPES_WITH_PDF.includes(c.type) && ['Approved', 'Issued'].includes(c.status);
            return (
              <div key={c._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.employee?.fullName} <span className="font-normal text-muted">({c.employee?.employeeId})</span>
                  </p>
                  <p className="text-xs text-muted">{CERTIFICATE_TYPE_LABELS[c.type]}</p>
                  {c.purpose && <p className="mt-1 text-xs text-muted">For: {c.purpose}</p>}
                  <ApprovalTrailView request={c} pendingStatus="Pending" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={CERTIFICATE_STATUS_VARIANT[c.status]}>{c.status}</Badge>
                  {hasPdf && (
                    <Button size="sm" variant="ghost" isLoading={downloadingId === c._id} onClick={() => handleDownload(c)}>
                      PDF
                    </Button>
                  )}
                  {c.canDecideCurrentStep && c.status === 'Pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setConfirming({ req: c, decision: 'Approved' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ req: c, decision: 'Rejected' })}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {canIssue && c.status === 'Approved' && (
                    <Button size="sm" variant="ghost" isLoading={issueMutation.isPending} onClick={() => issueMutation.mutate(c._id)}>
                      Mark issued
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.decision === 'Approved' ? 'Approve certificate request?' : 'Reject certificate request?'}
        message={
          confirming &&
          `${confirming.decision === 'Approved' ? 'Approve' : 'Reject'} ${confirming.req.employee?.fullName}'s ${CERTIFICATE_TYPE_LABELS[confirming.req.type]} request? This cannot be undone.`
        }
        confirmLabel={confirming?.decision === 'Approved' ? 'Approve' : 'Reject'}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.req._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}
