/**
 * DirectoryStatsWidget — Active Clients / Active Subcontractors counts.
 *
 * Both clickable through to their real list page (2026-09-24, a real user
 * ask — dashboard stat tiles should go somewhere, not just report a number)
 * — Clients only when `activeClients` is a real figure (the server nulls it
 * without `clientsManage` read; this widget's own visibility gate is
 * `activeSubcontractors`, a separate grant, so the two can legitimately
 * diverge for one viewer). Subcontractors is always clickable here, since
 * this widget never renders at all without `subcontractorsManage` read.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';

function StatTile({ to, value, label }) {
  const tile = (
    <Card
      className={`group relative flex flex-col items-center justify-center py-6 transition-colors ${
        to ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
      }`}
    >
      {to && (
        <svg
          className="absolute right-4 top-4 h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      )}
      <span className="text-3xl font-bold text-text">{value ?? 0}</span>
      <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {tile}
    </Link>
  ) : (
    tile
  );
}

export default function DirectoryStatsWidget({ activeClients, activeSubcontractors }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatTile to={activeClients != null ? '/clients' : null} value={activeClients} label={t('staffDashboard.stats.activeClients')} />
      <StatTile to="/subcontractors" value={activeSubcontractors} label={t('staffDashboard.widgets.activeSubcontractors')} />
    </div>
  );
}
