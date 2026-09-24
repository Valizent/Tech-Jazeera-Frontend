/**
 * CoordinatorLeaderboardWidget — every real Coordinator, ranked by this month's
 * mobilisation count and estimated profit (2026-09-22, a real user ask — "where
 * is the coordinator mobilisation count/leaderboard for MM/GM/FM/COO etc?").
 *
 * Gated the same as the "Global mobilisation pipeline" widget right next to it
 * (mobilisationsViewer read) — see dashboard.service.js's own getCoordinatorLeaderboard
 * doc comment for why this reaches MM/GM/FM/COO/Admin without needing
 * mobilisationTargets write, unlike the pre-existing target-Progress list (which only
 * ever showed a coordinator who already had a target set that month).
 *
 * No single default ranking (the user's own choice, put to them directly): both
 * "Mobilisations" and "Est. profit" are clickable column headers that sort the table,
 * same click-to-flip-direction convention every other sortable list in this app uses.
 * Clicking a row opens the existing CoordinatorDrillDownModal for that coordinator's
 * full detail (recent logs, tasks, generated profit) — reusing it rather than building
 * a second drill-down.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { getCoordinatorLeaderboard } from '../dashboard.api.js';
import { formatMoney } from '../../../lib/utils.js';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import CoordinatorDrillDownModal from './CoordinatorDrillDownModal.jsx';

function SortIcon({ active, direction }) {
  return (
    <svg
      className={`ml-1 inline h-3 w-3 transition-transform ${active ? 'text-text' : 'text-muted/40'} ${active && direction === 'asc' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function CoordinatorLeaderboardWidget() {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState('profit');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownCoordinator, setDrillDownCoordinator] = useState(null);

  const month = new Date().toISOString().slice(0, 7);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'coordinator-leaderboard', month],
    queryFn: () => getCoordinatorLeaderboard(month),
  });

  function toggleSort(key) {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  }

  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a[sortBy] - b[sortBy];
    });
    if (sortBy !== 'name' && sortOrder === 'desc') sorted.reverse();
    if (sortBy === 'name' && sortOrder === 'desc') sorted.reverse();
    return sorted;
  }, [data, sortBy, sortOrder]);

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
        <PickerLoadWarning failed={[{ label: t('staffDashboard.widgets.leaderboard.loadFailed'), isError: true }]} />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.leaderboard.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t('staffDashboard.widgets.leaderboard.subtitle')}</p>
        </div>
        {/* Same header-link convention as RecentActivity's "View full log" — a plain
            list-to-detail affordance, not a redesign, and it doesn't collide with a
            row's own click (which opens the drill-down modal, not this page). */}
        <Link to="/mobilisations" className="shrink-0 text-xs font-medium text-primary hover:underline">
          {t('staffDashboard.widgets.leaderboard.viewAll')}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t('staffDashboard.widgets.leaderboard.emptyTitle')}
          description={t('staffDashboard.widgets.leaderboard.emptyDescription')}
        />
      ) : (
        <div className="flex-1 overflow-auto max-h-96 -mx-4 sm:mx-0">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-bg text-muted z-10 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" className="flex items-center hover:text-text" onClick={() => toggleSort('name')}>
                    {t('staffDashboard.widgets.leaderboard.coordinator')}
                    <SortIcon active={sortBy === 'name'} direction={sortOrder} />
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-center">
                  <button type="button" className="flex items-center justify-center hover:text-text mx-auto" onClick={() => toggleSort('count')}>
                    {t('staffDashboard.widgets.leaderboard.mobilisations')}
                    <SortIcon active={sortBy === 'count'} direction={sortOrder} />
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-right">
                  <button type="button" className="flex items-center justify-end hover:text-text ml-auto" onClick={() => toggleSort('profit')}>
                    {t('staffDashboard.widgets.leaderboard.estProfit')}
                    <SortIcon active={sortBy === 'profit'} direction={sortOrder} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr
                  key={r._id}
                  className="cursor-pointer hover:bg-muted/5"
                  onClick={() => setDrillDownCoordinator({ _id: r._id, name: r.name })}
                >
                  <td className="px-4 py-3 font-medium text-text">{r.name}</td>
                  <td className="px-4 py-3 text-center text-muted">{r.count}</td>
                  <td className="px-4 py-3 text-right font-medium text-muted">{formatMoney(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drillDownCoordinator && (
        <CoordinatorDrillDownModal
          open={Boolean(drillDownCoordinator)}
          onClose={() => setDrillDownCoordinator(null)}
          coordinator={drillDownCoordinator}
        />
      )}
    </Card>
  );
}
