/**
 * FloorTodayCard: who is working today. The people who have signed in, and the
 * workers who have sat on standby longer than two weeks (no pay figure here:
 * the Standby Analysis widget owns the cost view behind its own grant).
 */
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatTime } from '../../../lib/utils.js';

const IDLE_STANDBY_DAYS = 14;

export default function FloorTodayCard({ signedIn, idle }) {
  const { t } = useTranslation();
  const hasSignedIn = signedIn && signedIn.count > 0;
  const hasIdle = idle && idle.count > 0;
  if (!hasSignedIn && !hasIdle) return null;
  const k = (key, opts) => t(`staffDashboard.insights.floor.${key}`, opts);

  return (
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{k('title')}</h2>
      <div className="space-y-5">
        {hasSignedIn && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {k('signedIn')} · {signedIn.count}
            </h3>
            <ul className="divide-y divide-border text-sm">
              {signedIn.recent.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex justify-between gap-3 py-1.5">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted">{formatTime(p.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasIdle && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {k('idle', { days: IDLE_STANDBY_DAYS })} · {idle.count}
            </h3>
            <ul className="divide-y divide-border text-sm">
              {idle.items.map((w) => (
                <li key={`${w.ref}-${w.name}`} className="flex justify-between gap-3 py-1.5">
                  <span className="truncate">{w.name}</span>
                  <span className="shrink-0 text-xs text-muted">{k('idleDays', { days: w.days })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
