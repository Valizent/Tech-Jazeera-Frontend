/**
 * Dashboard — the management overview. One query to /dashboard feeds headline
 * stats, a finance summary, workforce/quotation breakdowns, expiring-document
 * alerts, recent activity, and role-aware quick actions. Replaces the M3
 * placeholder.
 *
 * Widget visibility (added 2026-09-13): every field below is `null` from the
 * server when the viewer lacks read access to that field's own underlying
 * Section Access key (see dashboard.service.js's own doc comment) — this
 * page never re-checks a role itself for whether to SHOW something, it just
 * renders each widget only when its data is actually present. The one
 * remaining role check (`isCoordinator`) is for SCOPING/labeling only — e.g.
 * "Your Clients" vs. "Active Clients" — not for deciding whether a widget
 * exists at all.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../dashboard.api.js';
import { getMyTarget } from '../../mobilisationTargets/mobilisationTargets.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../../lib/utils.js';
import { EXPIRY_WARNING_DAYS } from '../../../lib/constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Button from '../../../components/ui/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBreakdown from '../components/StatusBreakdown.jsx';
import ExpiringDocuments from '../components/ExpiringDocuments.jsx';
import RecentActivity from '../components/RecentActivity.jsx';
import QuickActions from '../components/QuickActions.jsx';
import ProfitCard from '../components/ProfitCard.jsx';
import MyPendingActions from '../components/MyPendingActions.jsx';
import MobilisationTargetCard from '../components/MobilisationTargetCard.jsx';
import ManageTargetsModal from '../components/ManageTargetsModal.jsx';

/** A labelled money figure for the finance card. */
function FinanceItem({ label, value, hint, accent }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? 'text-text'}`}>{formatMoney(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const THRESHOLD_STORAGE_KEY = 'aj-erp:dashboard-alert-threshold';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  // P2-M2: a personal display preference — not worth a server round trip, so
  // it lives in localStorage, per browser/device, like any other UI setting.
  const [thresholdDays, setThresholdDays] = useState(
    () => Number(localStorage.getItem(THRESHOLD_STORAGE_KEY)) || EXPIRY_WARNING_DAYS
  );
  function changeThreshold(days) {
    setThresholdDays(days);
    localStorage.setItem(THRESHOLD_STORAGE_KEY, String(days));
  }

  // P2-M8: which month the Profit section shows.
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [targetsOpen, setTargetsOpen] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['dashboard', thresholdDays, month],
    queryFn: () => getDashboard(thresholdDays, month),
  });

  const firstName = user.name.split(' ')[0];
  const isCoordinator = user.role === 'Coordinator';
  const isManager = user.role === 'Manager';
  const canManageTargets = 
    user.role === 'Admin' || 
    user.role === 'Manager' || 
    (user.sectionAccessWrite || []).includes('mobilisationTargets');

  // Coordinator's own monthly target — always fetched for coordinator logins,
  // never for others (null guard in MobilisationTargetCard hides the widget).
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: myTarget } = useQuery({
    queryKey: ['mob-target-my', currentMonth],
    queryFn: () => getMyTarget(currentMonth),
    enabled: isCoordinator,
  });

  // Management: coordinator list for the ManageTargetsModal selector.
  // Reuse the mobilisations coordinator endpoint (same list, no extra cost).
  const { data: coordinatorList = [] } = useQuery({
    queryKey: ['coordinator-candidates'],
    queryFn: () => import('../../mobilisations/mobilisations.api.js').then((m) => m.listCoordinatorCandidates()),
    enabled: targetsOpen,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('staffDashboard.welcomeBack', { name: firstName })} />
        <EmptyState
          title={t('staffDashboard.couldNotLoad')}
          description={t('staffDashboard.checkConnectionRetry')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      </div>
    );
  }

  const { stats, finance, workforceByStatus, quotationsByStatus, expiringDocuments, recentActivity, myPendingActions } =
    data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDashboard.welcomeBack', { name: firstName })}
        description={isCoordinator ? t('staffDashboard.subtitleTeam') : t('staffDashboard.subtitleCompany')}
        actions={
          canManageTargets ? (
            <Button variant="secondary" onClick={() => setTargetsOpen(true)}>
              🎯 Manage Targets
            </Button>
          ) : null
        }
      />

      {/* Only ever non-zero for Admin/Manager/HR — a Coordinator's own
          submissions aren't counted here (see dashboard.service.js). Hidden
          entirely at zero so it never sits around as dead chrome. */}
      {stats.pendingClientApprovals > 0 && (
        <Link
          to="/coordinator-activity"
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
        >
          <span className="font-medium text-text">
            {t('staffDashboard.clientsWaitingApproval', { count: stats.pendingClientApprovals })}
          </span>
          <span className="font-medium text-primary">{t('staffDashboard.review')}</span>
        </Link>
      )}

      {/* Headline stats — each StatCard only renders when the server actually
          sent a value; see this file's own top doc comment. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.deployedActive != null && (
          <StatCard label={t('staffDashboard.stats.deployedNow')} value={stats.deployedActive} accent="primary" hint={t('staffDashboard.stats.activePlacements')} to="/deployments" />
        )}
        {stats.activeWorkers != null && (
          <StatCard
            label={t('staffDashboard.stats.activeWorkers')}
            value={stats.activeWorkers}
            accent="success"
            hint={t('staffDashboard.stats.workersHint', { total: stats.totalWorkers, onLeave: stats.onLeave })}
            to="/employees"
          />
        )}
        {stats.activeClients != null && (
          <StatCard label={isCoordinator ? t('staffDashboard.stats.yourClients') : t('staffDashboard.stats.activeClients')} value={stats.activeClients} to="/clients" />
        )}
        {isCoordinator
          ? stats.expiringSoon != null && (
              <StatCard label={t('staffDashboard.stats.expiringSoon')} value={stats.expiringSoon} accent="warning" hint={t('staffDashboard.stats.documentsNeedingAttention')} />
            )
          : stats.pendingQuotations != null && (
              <StatCard
                label={t('staffDashboard.stats.pendingQuotations')}
                value={stats.pendingQuotations}
                accent="warning"
                hint={isManager ? t('staffDashboard.stats.yourDraftsAwaiting') : t('staffDashboard.stats.draftAwaiting')}
                to="/quotations"
              />
            )}
        {stats.markedToday != null && (
          <StatCard
            label={t('staffDashboard.stats.markedToday')}
            value={stats.markedToday}
            hint={t('staffDashboard.stats.ofActiveWorkers', { count: stats.activeWorkers })}
            to="/attendance/summary"
          />
        )}
      </div>

      <MyPendingActions items={myPendingActions} />

      {/* Coordinator's own monthly target — hidden if no target set */}
      {isCoordinator && myTarget !== undefined && (
        <MobilisationTargetCard target={myTarget} />
      )}

      {/* Finance summary — each figure (and the whole Pipeline card, and
          ProfitCard) only renders when the server actually sent it, driven
          by real Section Access read grants, not a hardcoded role list —
          see dashboard.service.js's own doc comment. */}
      {(finance.approvedRevenue != null || finance.pendingRevenue != null || finance.monthlyPayroll != null) && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.pipeline.title')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {finance.approvedRevenue != null && (
              <FinanceItem label={t('staffDashboard.pipeline.approvedRevenue')} value={finance.approvedRevenue} accent="text-success" hint={t('staffDashboard.pipeline.approvedQuotations')} />
            )}
            {finance.pendingRevenue != null && (
              <FinanceItem label={t('staffDashboard.pipeline.pipeline')} value={finance.pendingRevenue} hint={t('staffDashboard.pipeline.draftQuotations')} />
            )}
            {finance.monthlyPayroll != null && (
              <FinanceItem label={t('staffDashboard.pipeline.monthlyPayroll')} value={finance.monthlyPayroll} hint={t('staffDashboard.pipeline.workforceSalariesRunRate')} />
            )}
          </div>
        </Card>
      )}

      {/* P2-M8: real profit for a selected month — Revenue − Payroll −
          Expenses, from Invoices/finalized Payroll/Expenses. Requires read
          on all three (see dashboard.service.js's canSeeProfit) — a partial
          figure built from only some of its real inputs would be an actual
          number that means something else entirely. */}
      {finance.profit != null && <ProfitCard profit={finance.profit} month={month} onMonthChange={setMonth} />}

      {/* Breakdowns */}
      {(workforceByStatus != null || quotationsByStatus != null) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {workforceByStatus != null && (
            <StatusBreakdown
              title={isCoordinator ? t('staffDashboard.yourTeamByStatus') : t('staffDashboard.workforceByStatus')}
              data={workforceByStatus}
              colors={{ Active: 'success', 'On Leave': 'warning', Exited: 'default' }}
            />
          )}
          {quotationsByStatus != null && (
            <StatusBreakdown
              title={t('staffDashboard.quotationsByStatus')}
              data={quotationsByStatus}
              colors={{ Draft: 'default', Approved: 'success', Rejected: 'danger' }}
            />
          )}
        </div>
      )}

      {/* Alerts + activity — ExpiringDocuments always renders (it's a list
          built from independently-gated sources, naturally empty rather
          than absent when neither is readable, and shows its own empty
          state); RecentActivity only when the server actually sent it.
          Side-by-side only when both show. */}
      {recentActivity != null ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ExpiringDocuments items={expiringDocuments} thresholdDays={thresholdDays} onThresholdChange={changeThreshold} scopedToTeam={isCoordinator} />
          <RecentActivity items={recentActivity} />
        </div>
      ) : (
        <ExpiringDocuments items={expiringDocuments} thresholdDays={thresholdDays} onThresholdChange={changeThreshold} scopedToTeam={isCoordinator} />
      )}

      <QuickActions />

      {/* Manage Targets modal — management only */}
      <ManageTargetsModal
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        coordinators={coordinatorList}
      />
    </div>
  );
}
