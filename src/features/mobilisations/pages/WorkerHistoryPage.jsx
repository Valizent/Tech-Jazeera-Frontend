/**
 * WorkerHistoryPage (2026-09-17, the user's own ask — "how do I delete a
 * freelancer's/subcontractor employee's data") — a Freelancer/
 * SupplierEmployee worker has no Employee HR record of their own to exit or
 * deactivate; their only footprint in this app is every Mobilisation (and
 * any Deployment it produced) sharing their Iqama number. Look them up by
 * that Iqama, see every record on file, and archive all of it in one
 * action once they're no longer relevant — two real design choices the
 * user made directly when asked: PER-WORKER (not one record at a time) and
 * ARCHIVE, not permanent delete (recoverable, keeps real approved
 * financial history intact for audit/reporting — a Saudi PDPL-friendly
 * posture). See mobilisation.service.js's getWorkerHistory/
 * archiveWorkerData/unarchiveWorkerData for the actual mechanics — every
 * shared list/lookup/autofill query across Mobilisation AND Deployment now
 * excludes `archived: true` by default, so this is a real "disappear from
 * everywhere" action, not cosmetic.
 *
 * Admin-only, matching the existing (temporary, single-record) Delete
 * buttons' own posture — this is a broader, cross-collection action, so it
 * stays at least as narrow. Reached via a "Worker data" button on both the
 * Standby List and the Mobilisations list (no sidebar nav entry, same
 * "reachable but not a top-level destination" treatment as
 * /deployments/standby itself).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getWorkerHistory, archiveWorkerData, unarchiveWorkerData } from '../mobilisations.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { MOBILISATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const DEPLOYMENT_STATUS_VARIANT = { Active: 'success', Ended: 'default' };
const iqamaRegex = /^\d{10}$/;

export default function WorkerHistoryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [iqamaInput, setIqamaInput] = useState('');
  const [searchedIqama, setSearchedIqama] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // 'archive' | 'unarchive' | null

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['mobilisations', 'worker-history', searchedIqama],
    queryFn: () => getWorkerHistory(searchedIqama),
    enabled: Boolean(searchedIqama),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveWorkerData(searchedIqama),
    onSuccess: () => {
      toast.success(t('staffMobilisations.workerHistory.archivedToast'));
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['mobilisations', 'worker-history', searchedIqama] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      console.error(error);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveWorkerData(searchedIqama),
    onSuccess: () => {
      toast.success(t('staffMobilisations.workerHistory.restoredToast'));
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['mobilisations', 'worker-history', searchedIqama] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      console.error(error);
    },
  });

  if (user.role !== 'Admin') return <Navigate to="/" replace />;

  const iqamaValid = iqamaRegex.test(iqamaInput.trim());

  function handleSearch(e) {
    e.preventDefault();
    if (iqamaValid) setSearchedIqama(iqamaInput.trim());
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('staffMobilisations.workerHistory.pageTitle')}
        description={t('staffMobilisations.workerHistory.pageDescription')}
        onBack={() => navigate(-1)}
      />

      <Card>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <Input
            label={t('staffMobilisations.workerHistory.searchLabel')}
            placeholder={t('staffMobilisations.workerHistory.searchPlaceholder')}
            value={iqamaInput}
            onChange={(e) => setIqamaInput(e.target.value)}
            className="sm:max-w-xs"
          />
          <Button type="submit" disabled={!iqamaValid} isLoading={isFetching}>
            {t('staffMobilisations.workerHistory.searchButton')}
          </Button>
        </form>
      </Card>

      {!searchedIqama ? null : isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <EmptyState title={t('staffDeployments.list.couldNotLoad')} description={t('staffDeployments.list.couldNotLoadDescription')} />
      ) : !data ? (
        <EmptyState
          title={t('staffMobilisations.workerHistory.notFoundTitle')}
          description={t('staffMobilisations.workerHistory.notFoundDescription')}
        />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text">{data.workerName}</h2>
                <p className="mt-1 text-sm text-muted">
                  {t(`staffMobilisations.form.workerType.${data.workerType}`, data.workerType)}
                  {data.subcontractorName && ` · ${data.subcontractorName}`}
                  {data.nationality && ` · ${data.nationality}`}
                  {data.phone && ` · ${data.phone}`}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t('staffMobilisations.workerHistory.recordCount', { count: data.records.length })}
                </p>
              </div>
              {data.hasActiveEngagement ? (
                <Badge variant="warning">{t('staffMobilisations.workerHistory.activeEngagementBadge')}</Badge>
              ) : data.allArchived ? (
                <Button variant="secondary" onClick={() => setConfirmAction('unarchive')}>
                  {t('staffMobilisations.workerHistory.restoreButton')}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setConfirmAction('archive')}>
                  {t('staffMobilisations.workerHistory.archiveButton')}
                </Button>
              )}
            </div>
            {data.hasActiveEngagement && (
              <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning ring-1 ring-inset ring-warning/25">
                {t('staffMobilisations.workerHistory.activeEngagementWarning')}
              </p>
            )}
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.mobilisationNumber')}</th>
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.client')}</th>
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.status')}</th>
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.mobilisationDate')}</th>
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.deployment')}</th>
                    <th className="px-3 py-2">{t('staffMobilisations.workerHistory.columns.archived')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.records.map((r) => (
                    <tr
                      key={r.mobilisationId}
                      className="cursor-pointer hover:bg-primary/[0.035]"
                      onClick={() => navigate(`/mobilisations/${r.mobilisationId}`)}
                    >
                      <td className="px-3 py-2 font-medium text-text">{r.serialNumber}</td>
                      <td className="px-3 py-2 text-text">{r.clientName}</td>
                      <td className="px-3 py-2">
                        <Badge variant={MOBILISATION_STATUS_VARIANT[r.status]}>{t(`common.status.${r.status}`, r.status)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-text">{formatDate(r.mobilisationDate)}</td>
                      <td className="px-3 py-2">
                        {r.deployment ? (
                          <Badge variant={DEPLOYMENT_STATUS_VARIANT[r.deployment.status]}>
                            {t(`staffDeployments.status.${r.deployment.status}`, r.deployment.status)}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-text">
                        {r.archived ? <Badge variant="default">{t('staffMobilisations.workerHistory.archivedBadge')}</Badge> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmAction === 'archive'}
        title={t('staffMobilisations.workerHistory.archiveConfirmTitle', { name: data?.workerName })}
        message={t('staffMobilisations.workerHistory.archiveConfirmMessage', { count: data?.records.length })}
        confirmLabel={t('staffMobilisations.workerHistory.archiveButton')}
        confirmVariant="primary"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'unarchive'}
        title={t('staffMobilisations.workerHistory.restoreConfirmTitle', { name: data?.workerName })}
        message={t('staffMobilisations.workerHistory.restoreConfirmMessage', { count: data?.records.length })}
        confirmLabel={t('staffMobilisations.workerHistory.restoreButton')}
        confirmVariant="primary"
        loading={unarchiveMutation.isPending}
        onConfirm={() => unarchiveMutation.mutate()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
