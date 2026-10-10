/**
 * VacationReviewPanel — the staff review queue for Annual Vacation requests.
 * Approve/Reject appears per row from the server-computed
 * `canDecideCurrentStep` (Section Access Write + the approval engine's step
 * authority); the decide endpoint stays the real gate.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listAnnualVacation, decideAnnualVacation, VACATION_QUEUE_KEY } from '../annualVacation.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { ANNUAL_VACATION_STATUSES, ANNUAL_VACATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';

export default function VacationReviewPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('PendingReview');
  // { req, decision } while the "are you sure?" dialog is open.
  const [confirming, setConfirming] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...VACATION_QUEUE_KEY, { status }],
    queryFn: () => listAnnualVacation({ limit: 50, ...(status && { status }) }),
    // A request filed from another session has no other way to reach an open queue.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }) => decideAnnualVacation(id, { status: decision }),
    onSuccess: (request) => {
      toast.success(t(request.status === 'Approved' ? 'staffAnnualVacation.approvedToast' : 'staffAnnualVacation.rejectedToast'));
      queryClient.invalidateQueries({ queryKey: VACATION_QUEUE_KEY });
      // An approval records a leave — the Leave screens should refetch too.
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setConfirming(null),
  });

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffAnnualVacation.queueTitle')}</h2>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[200px]" aria-label={t('common.filter')}>
          <option value="">{t('common.allStatuses')}</option>
          {ANNUAL_VACATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <EmptyState
          title={t('staffAnnualVacation.loadError')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title={t('staffAnnualVacation.queueEmpty')} description={t('staffAnnualVacation.queueEmptyDescription')} />
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((r) => (
            <div key={r._id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.employee?.fullName} <span className="font-normal text-muted">({r.employee?.employeeId})</span>
                </p>
                <p className="text-xs text-muted">
                  {t('staffAnnualVacation.rangeLabel', { start: formatDate(r.startDate), end: formatDate(r.endDate), days: r.requestedDays })}
                </p>
                {r.reason && <p className="mt-1 text-xs text-muted">{r.reason}</p>}
                <ApprovalTrailView request={r} pendingStatus="PendingReview" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={ANNUAL_VACATION_STATUS_VARIANT[r.status]}>{t(`common.status.${r.status}`, r.status)}</Badge>
                {r.canDecideCurrentStep && r.status === 'PendingReview' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirming({ req: r, decision: 'Approved' })}>
                      {t('common.approve')}
                    </Button>
                    <Button size="sm" variant="danger-ghost" onClick={() => setConfirming({ req: r, decision: 'Rejected' })}>
                      {t('common.reject')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirming}
        title={t(confirming?.decision === 'Approved' ? 'staffAnnualVacation.approveTitle' : 'staffAnnualVacation.rejectTitle')}
        message={
          confirming &&
          t(confirming.decision === 'Approved' ? 'staffAnnualVacation.approveMessage' : 'staffAnnualVacation.rejectMessage', {
            name: confirming.req.employee?.fullName,
          })
        }
        confirmLabel={t(confirming?.decision === 'Approved' ? 'common.approve' : 'common.reject')}
        confirmVariant={confirming?.decision === 'Approved' ? 'primary' : 'danger'}
        loading={decideMutation.isPending}
        onConfirm={() => decideMutation.mutate({ id: confirming.req._id, decision: confirming.decision })}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}
