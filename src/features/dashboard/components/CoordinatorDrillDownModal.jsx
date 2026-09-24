import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import { getCoordinatorDrillDown } from '../dashboard.api.js';
import { formatMoney, formatDate } from '../../../lib/utils.js';

/** `month`: "YYYY-MM", same value the leaderboard row that opened this modal
 *  was computed for — so "Generated profit" here is always the exact number
 *  the viewer just clicked, not a silently different all-time total (see
 *  dashboard.service.js's own 2026-09-24 fix comment on getCoordinatorDrillDown). */
export default function CoordinatorDrillDownModal({ open, onClose, coordinator, month }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Same "don't link somewhere that just 403s" idiom DailyUpdatesPage's own
  // canOpenBoard already uses for a Requirements tag — a viewer who can see
  // the leaderboard (mobilisationsViewer) doesn't necessarily also have
  // dailyUpdatesTeam read, so the tile stays plain, non-interactive text
  // for them instead of a dead-end link.
  const canOpenTasks = Boolean(user.sectionAccess?.includes('dailyUpdatesTeam'));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'coordinator-drill-down', coordinator?._id, month],
    queryFn: () => getCoordinatorDrillDown(coordinator._id, month),
    enabled: open && !!coordinator?._id,
  });

  function openMobilisations() {
    onClose();
    navigate(`/mobilisations?coordinator=${coordinator._id}&coordinatorName=${encodeURIComponent(coordinator.name)}`);
  }

  function openTasks() {
    onClose();
    navigate(`/daily-updates?tab=tasks&coordinator=${coordinator._id}&coordinatorName=${encodeURIComponent(coordinator.name)}`);
  }

  return (
    <Modal open={open} onClose={onClose} title={t('staffDashboard.drillDown.title', { name: coordinator?.name })}>
      {isLoading ? (
        <div className="h-48 animate-pulse rounded bg-muted/20" />
      ) : isError ? (
        <div className="text-center text-danger py-4">{t('staffDashboard.drillDown.loadFailed')}</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={openMobilisations}
              className="rounded-lg border border-border bg-bg/50 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="text-sm font-medium text-muted mb-1">{t('staffDashboard.drillDown.generatedProfit')}</div>
              <div className="text-2xl font-bold text-success">{formatMoney(data.totalMonthlyProfit)}</div>
            </button>
            {canOpenTasks ? (
              <button
                type="button"
                onClick={openTasks}
                className="rounded-lg border border-border bg-bg/50 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="text-sm font-medium text-muted mb-1">{t('staffDashboard.drillDown.assignedTasks')}</div>
                <div className="text-xl font-bold text-text">
                  <span className="text-success">{data.tasks.completed}</span> / {data.tasks.open + data.tasks.completed}
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-border bg-bg/50 p-4 text-center">
                <div className="text-sm font-medium text-muted mb-1">{t('staffDashboard.drillDown.assignedTasks')}</div>
                <div className="text-xl font-bold text-text">
                  <span className="text-success">{data.tasks.completed}</span> / {data.tasks.open + data.tasks.completed}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 border-b border-border pb-2">{t('staffDashboard.drillDown.recentLogEntries')}</h3>
            {/* A Log entry is one plain `text` field, not an array of sub-entries — matches
                dailyUpdate.model.js's real shape (see the coordinator-drill-down crash fix). */}
            {data.recentLogs?.length === 0 ? (
              <p className="text-xs text-muted italic">{t('staffDashboard.drillDown.noRecentLogs')}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentLogs.map((log) => (
                  <li key={log._id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="text-xs font-semibold text-muted">{formatDate(log.date)}</div>
                    <div className="mt-1 line-clamp-3 whitespace-pre-wrap">{log.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  );
}
