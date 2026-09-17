/**
 * StandbyListPage — who's currently free to mobilise (2026-09-14, a real
 * user ask). Two genuinely different sections, not one merged table — see
 * the server's own getStandbyWorkforce doc comment for why: an 'Own'
 * Worker-login employee's availability is a live field (`currentClient`);
 * a subcontractor/freelancer worker's is derived from their placement
 * history (no Employee record, no such field exists for them at all).
 *
 * Each row's own "Mobilise" button (2026-09-16, the user's own ask) deep-
 * links to New Mobilisation with that worker pre-filled — see
 * MobilisationNewPage's own header comment for exactly which query params
 * it reads. An Own Employee only needs `workerType`+`worker` (their live
 * Employee record is the trustworthy source for everything else); a
 * SupplierEmployee/Freelancer needs its identity snapshotted into the URL
 * the same way MobilisationForm's own Iqama-autofill/PreviousWorkerPicker
 * already fill those fields in. Table's own onRowClick already ignores
 * clicks that land on a button, so this needed no extra wiring on the Own
 * Employees table (still row-clickable → the Employee profile).
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getStandbyWorkforce } from '../deployments.api.js';
import { formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Builds the New Mobilisation deep-link query string for one standby row —
 *  see this file's own header comment and MobilisationNewPage's for what
 *  each param does. */
function mobiliseOwnEmployeeUrl(employee) {
  return `/mobilisations/new?${new URLSearchParams({ workerType: 'Employee', worker: employee._id })}`;
}

function mobiliseWorkerUrl(worker) {
  const params = new URLSearchParams({ workerType: worker.workerType, workerName: worker.workerName });
  if (worker.iqamaNumber) params.set('iqamaNumber', worker.iqamaNumber);
  if (worker.nationality) params.set('nationality', worker.nationality);
  if (worker.phone) params.set('phone', worker.phone);
  if (worker.workerType === 'SupplierEmployee' && worker.subcontractor) params.set('subcontractor', worker.subcontractor);
  return `/mobilisations/new?${params}`;
}

export default function StandbyListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
    {
      key: 'mobilise',
      header: '',
      className: 'text-right',
      render: (e) => (
        <Button size="sm" onClick={() => navigate(mobiliseOwnEmployeeUrl(e))}>
          {t('staffDeployments.standby.mobiliseAction')}
        </Button>
      ),
    },
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
    {
      key: 'mobilise',
      header: '',
      className: 'text-right',
      render: (w) => (
        <Button size="sm" onClick={() => navigate(mobiliseWorkerUrl(w))}>
          {t('staffDeployments.standby.mobiliseAction')}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.standby.pageTitle')}
        description={t('staffDeployments.standby.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            {user.role === 'Admin' && (
              <Button variant="secondary" onClick={() => navigate('/mobilisations/worker-history')}>
                {t('staffDeployments.standby.workerDataButton')}
              </Button>
            )}
            <Button onClick={() => navigate('/mobilisations/new')}>{t('staffDeployments.standby.newMobilisation')}</Button>
          </div>
        }
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
