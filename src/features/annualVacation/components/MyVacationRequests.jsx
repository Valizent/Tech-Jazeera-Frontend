/**
 * MyVacationRequests — the signed-in employee's own Annual Vacation requests,
 * with Cancel while a request is still pending. `fetchRequests`/`cancelRequest`
 * are the /api/me functions on the ESS page and the /api/annual-vacation/mine
 * ones on the staff page.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { ANNUAL_VACATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';

export default function MyVacationRequests({ queryKey, fetchRequests, cancelRequest }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({ queryKey, queryFn: () => fetchRequests({ limit: 50 }) });

  const cancelMutation = useMutation({
    mutationFn: cancelRequest,
    onSuccess: () => {
      toast.success(t('staffAnnualVacation.cancelledToast'));
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => setToCancel(null),
  });

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffAnnualVacation.yourRequests')}</h2>
      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : isError ? (
        <EmptyState
          title={t('staffAnnualVacation.loadError')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title={t('staffAnnualVacation.empty')} description={t('staffAnnualVacation.emptyDescription')} />
      ) : (
        <Card className="divide-y divide-border">
          {data.items.map((r) => (
            <div key={r._id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {t('staffAnnualVacation.rangeLabel', { start: formatDate(r.startDate), end: formatDate(r.endDate), days: r.requestedDays })}
                </p>
                {r.reason && <p className="mt-1 text-xs text-muted">{r.reason}</p>}
                {r.decisionNote && (
                  <p className="mt-1 text-xs italic text-muted">
                    {t('common.note')}: {r.decisionNote}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={ANNUAL_VACATION_STATUS_VARIANT[r.status]}>{t(`common.status.${r.status}`, r.status)}</Badge>
                {r.status === 'PendingReview' && (
                  <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(r)}>
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
      <ConfirmDialog
        open={!!toCancel}
        title={t('staffAnnualVacation.cancelDialogTitle')}
        message={t('staffAnnualVacation.cancelDialogMessage')}
        confirmLabel={t('staffAnnualVacation.cancelConfirm')}
        confirmVariant="danger"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </div>
  );
}
