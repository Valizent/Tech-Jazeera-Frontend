/**
 * StandbyListPage — who's currently free to mobilise (2026-09-14, a real
 * user ask). Two genuinely different sections, not one merged table — see
 * the server's own getStandbyWorkforce doc comment for why: an 'Own'
 * Worker-login employee's availability is a live field (`currentClient`);
 * a subcontractor/freelancer worker's is derived from their placement
 * history (no Employee record, no such field exists for them at all).
 * Read-only — mobilising someone starts on the regular New Mobilisation form.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStandbyWorkforce } from '../deployments.api.js';
import { formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function StandbyListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', 'standby'],
    queryFn: getStandbyWorkforce,
  });

  const ownColumns = [
    {
      key: 'fullName',
      header: t('staffDeployments.standby.columns.employee'),
      render: (e) => (
        <span className="font-medium text-text">
          {e.fullName}
          <span className="block text-xs font-normal text-muted">{e.employeeId}</span>
        </span>
      ),
    },
    { key: 'designation', header: t('staffDeployments.standby.columns.designation'), render: (e) => e.designation },
    { key: 'nationality', header: t('staffDeployments.standby.columns.nationality'), hideOnMobile: true, render: (e) => e.nationality },
    { key: 'mobile', header: t('staffDeployments.standby.columns.mobile'), hideOnMobile: true, render: (e) => e.mobile },
  ];

  const subcontractedColumns = [
    {
      key: 'workerName',
      header: t('staffDeployments.standby.columns.worker'),
      render: (w) => (
        <span className="font-medium text-text">
          {w.workerName}
          <span className="block text-xs font-normal text-muted">
            {t(`staffMobilisations.form.workerType.${w.workerType}`, w.workerType)} · {w.iqamaNumber}
          </span>
        </span>
      ),
    },
    { key: 'nationality', header: t('staffDeployments.standby.columns.nationality'), hideOnMobile: true, render: (w) => w.nationality },
    { key: 'phone', header: t('staffDeployments.standby.columns.mobile'), hideOnMobile: true, render: (w) => w.phone },
    {
      key: 'subcontractor',
      header: t('staffDeployments.standby.columns.subcontractor'),
      hideOnMobile: true,
      render: (w) => w.subcontractorName ?? '—',
    },
    {
      key: 'last',
      header: t('staffDeployments.standby.columns.lastPlacement'),
      render: (w) => (
        <span className="text-sm">
          {w.lastClientName}
          {w.lastEndDate && <span className="block text-xs text-muted">{t('staffDeployments.standby.endedOn', { date: formatDate(w.lastEndDate) })}</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.standby.pageTitle')}
        description={t('staffDeployments.standby.pageDescription')}
        onBack={() => navigate(-1)}
        actions={<Button onClick={() => navigate('/mobilisations/new')}>{t('staffDeployments.standby.newMobilisation')}</Button>}
      />

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.standby.couldNotLoad')} description={t('common.checkConnection')} />
      ) : (
        <>
          <Card>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {t('staffDeployments.standby.ownEmployeesTitle')}
            </h2>
            <p className="mb-4 text-xs text-muted">{t('staffDeployments.standby.ownEmployeesDescription')}</p>
            <Table
              columns={ownColumns}
              rows={data.ownEmployees}
              rowKey={(e) => e._id}
              onRowClick={(e) => navigate(`/employees/${e._id}`)}
              emptyState={
                <EmptyState
                  title={t('staffDeployments.standby.ownEmployeesEmptyTitle')}
                  description={t('staffDeployments.standby.ownEmployeesEmptyDescription')}
                />
              }
            />
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {t('staffDeployments.standby.subcontractedTitle')}
            </h2>
            <p className="mb-4 text-xs text-muted">{t('staffDeployments.standby.subcontractedDescription')}</p>
            <Table
              columns={subcontractedColumns}
              rows={data.subcontractedWorkers}
              rowKey={(w) => w.iqamaNumber}
              emptyState={
                <EmptyState
                  title={t('staffDeployments.standby.subcontractedEmptyTitle')}
                  description={t('staffDeployments.standby.subcontractedEmptyDescription')}
                />
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
