import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '../../../components/ui/Card.jsx';
import RecentActivity from './RecentActivity.jsx';
import { api } from '../../../lib/axios.js';
import { timeAgo } from '../../../lib/utils.js';

const SENTRY_URL = import.meta.env.VITE_SENTRY_URL;

/** GET /api/health is real, public, and already deployed (app.js) — this
 *  just asks it instead of asserting "all running normally" unconditionally. */
async function checkHealth() {
  await api.get('/health', { timeout: 5000 });
  return true;
}

/** Fixed 2026-10-06, a real QA-audit finding (O01): this card claimed live
 *  operational knowledge ("all critical system services are running
 *  normally") it never actually had — `recentActivity` is just the audit
 *  feed, nothing here ever checked real health, so the message stayed
 *  identical whether the API was healthy or actively 500ing. Now it asks the
 *  real health endpoint and shows what it actually found, with when it last
 *  checked — refetched periodically so a real outage doesn't keep showing a
 *  stale "reachable" from before it started. The Sentry link is hidden
 *  entirely (not a dead '#') when no Sentry URL is configured. */
export default function SystemLogsWidget({ recentActivity }) {
  const { t } = useTranslation();
  const { data: isUp, isFetching, dataUpdatedAt, isError } = useQuery({
    queryKey: ['dashboard', 'apiHealth'],
    queryFn: checkHealth,
    retry: false,
    refetchInterval: 60_000,
  });

  const status = isFetching && dataUpdatedAt === 0 ? 'checking' : isError ? 'down' : isUp ? 'up' : 'checking';
  const statusColor = status === 'up' ? 'text-success' : status === 'down' ? 'text-danger' : 'text-muted';
  const cardTone = status === 'down' ? 'bg-danger/5 border-danger/20' : 'bg-surface border-border';

  return (
    // h-full flex-col (2026-09-24) — see StatusBreakdown's own doc comment. The
    // health card stays its own natural size; RecentActivity (flex-1) grows to
    // absorb whatever's left so the pair still matches ExpiringDocuments' height.
    <div className="flex h-full flex-col gap-4">
      <Card className={cardTone}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted flex items-center gap-2">
          <span>{t('staffDashboard.widgets.systemLogs.title')}</span>
        </h2>
        <p className={`text-xs mb-1 font-medium ${statusColor}`}>
          {status === 'checking' && t('staffDashboard.widgets.systemLogs.checking')}
          {status === 'up' && t('staffDashboard.widgets.systemLogs.up')}
          {status === 'down' && t('staffDashboard.widgets.systemLogs.down')}
        </p>
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            {t('staffDashboard.widgets.systemLogs.lastChecked', { time: timeAgo(dataUpdatedAt) })}
          </p>
        )}
        {SENTRY_URL && (
          <div className="flex gap-2">
            <a href={SENTRY_URL} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
              {t('staffDashboard.widgets.systemLogs.viewLogs')}
            </a>
          </div>
        )}
      </Card>
      <RecentActivity items={recentActivity} className="flex-1" />
    </div>
  );
}
