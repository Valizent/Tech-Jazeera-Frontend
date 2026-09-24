import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getStandbyAnalysis } from '../dashboard.api.js';
import { formatMoney } from '../../../lib/utils.js';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

const VISIBLE_ROWS = 2;

export default function StandbyAnalysisWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // This widget is gated on `payroll` read; the real Standby List page it
  // links to is gated on `deploymentsRelease` — two independent circles
  // (same "don't link somewhere that just 403s" idiom used elsewhere on
  // this dashboard, e.g. the Coordinator Drill-Down modal's task link).
  const canOpenStandbyList = Boolean(user.sectionAccess?.includes('deploymentsRelease'));
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'standby-analysis'],
    queryFn: getStandbyAnalysis,
  });

  if (isLoading) {
    return (
      <Card>
        <div className="h-48 animate-pulse rounded bg-muted/20" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <PickerLoadWarning failed={[{ label: t('staffDashboard.widgets.standby.loadFailed'), isError: true }]} />
      </Card>
    );
  }

  const workers = data ?? [];

  // Top 2 only — a dashboard tile, not the full register (that's the real
  // Standby List page, linked below). Preferring a real cost (moneyLost !=
  // null, i.e. this company's own salaried workforce) over a Supplier/
  // Freelancer entry with the same or even more days idle: the whole point
  // of this widget is the idle-COST estimate, and a Supplier/Freelancer row
  // never has one (this company owes them nothing while unplaced — see
  // dashboard.service.js's own getStandbyAnalysis doc comment) — surfacing
  // "—, —" ahead of a real Riyal figure would bury the one actionable
  // number this tile exists to show. Both groups arrive from the server
  // already sorted by daysOnStandby descending, so slicing preserves that
  // order within each group; only the group order is reprioritized here.
  const withCost = workers.filter((w) => w.moneyLost != null);
  const withoutCost = workers.filter((w) => w.moneyLost == null);
  const visibleWorkers = [...withCost, ...withoutCost].slice(0, VISIBLE_ROWS);
  const hiddenCount = workers.length - visibleWorkers.length;

  return (
    <Card className="flex flex-col h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.standby.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t('staffDashboard.widgets.standby.subtitle')}</p>
        </div>
        {hiddenCount > 0 && canOpenStandbyList && (
          <Link to="/deployments/standby" className="shrink-0 text-xs font-medium text-primary hover:underline">
            {t('staffDashboard.widgets.standby.viewAll')}
          </Link>
        )}
      </div>

      {workers.length === 0 ? (
        <EmptyState
          title={t('staffDashboard.widgets.standby.emptyTitle')}
          description={t('staffDashboard.widgets.standby.emptyDescription')}
        />
      ) : (
        <div className="flex-1 -mx-4 sm:mx-0">
          <table className="min-w-full text-left text-sm">
            <thead className="text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('staffDashboard.widgets.standby.worker')}</th>
                <th className="px-4 py-3 font-semibold text-center">{t('staffDashboard.widgets.standby.days')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('staffDashboard.widgets.standby.estLoss')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleWorkers.map((w) => (
                <tr key={w._id} className="hover:bg-muted/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{w.fullName}</div>
                    <div className="text-xs text-muted">
                      {w.designation
                        ? `${w.employeeId} • ${w.designation}`
                        : w.subcontractorName
                          ? `${t(`staffMobilisations.form.workerType.${w.workerType}`, w.workerType)} • ${w.subcontractorName}`
                          : t(`staffMobilisations.form.workerType.${w.workerType}`, w.workerType)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                      {t('staffDashboard.widgets.standby.daysCount', { count: w.daysOnStandby })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-muted">
                    {/* null for a Supplier/Freelancer worker — this company owes them
                        nothing while unplaced, so there's no honest cost to show (see
                        dashboard.service.js's own getStandbyAnalysis doc comment). */}
                    {w.moneyLost == null ? <span className="text-muted/50">—</span> : formatMoney(w.moneyLost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
