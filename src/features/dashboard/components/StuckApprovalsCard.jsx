/**
 * StuckApprovalsCard: requests that have waited on an approver for more than a
 * few days, per module, with the role they are waiting on. Oversight, not an
 * inbox: the "Waiting on you" card above is for what YOU can decide.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';

const STUCK_AFTER_DAYS = 3;

export default function StuckApprovalsCard({ rows }) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  return (
    <Card className="h-full">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.insights.stuck.title')}</h2>
      <p className="mb-3 mt-1 text-xs text-muted">{t('staffDashboard.insights.stuck.subtitle', { days: STUCK_AFTER_DAYS })}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <Link to={row.url} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/5">
              <div className="min-w-0">
                <p className="font-medium text-text">
                  {t(`staffDashboard.pendingModules.${row.label}`, row.label)} · {row.count}
                </p>
                <p className="truncate text-xs text-muted">{t('staffDashboard.insights.stuck.waitingOn', { names: row.waitingOn.join(', ') })}</p>
              </div>
              <Badge variant="warning">{t('staffDashboard.insights.stuck.oldest', { days: row.oldestDays })}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
