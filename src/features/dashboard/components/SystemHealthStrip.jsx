/**
 * SystemHealthStrip: an Admin-level glance at the things that go quiet until
 * they hurt: failed logins, access changes, logins nobody ever used, and what
 * the Reconciliation check currently finds. Each tile is null (hidden) unless
 * the viewer holds the Read behind that figure.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils.js';

export default function SystemHealthStrip({ health }) {
  const { t } = useTranslation();
  if (!health) return null;
  const tiles = [
    { key: 'failedLogins', value: health.failedLogins24h, to: '/security-log', warnAbove: 10 },
    { key: 'grantsChanged', value: health.grantsChanged7d, to: '/security-log', warnAbove: Infinity },
    { key: 'neverLoggedIn', value: health.neverLoggedIn, to: '/team', warnAbove: 0 },
    { key: 'reconciliation', value: health.reconciliationFindings, to: '/reconciliation', warnAbove: 0 },
  ].filter((tile) => tile.value != null);
  if (tiles.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.insights.health.title')}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.key} to={tile.to} className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/5">
            <p className={cn('text-2xl font-bold tabular-nums', tile.value > tile.warnAbove ? 'text-warning' : 'text-text')}>{tile.value}</p>
            <p className="mt-1 text-xs text-muted">{t(`staffDashboard.insights.health.${tile.key}`)}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
