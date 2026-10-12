/** FloorTodayCard: who is working today. The people who have signed in. */
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatTime } from '../../../lib/utils.js';

export default function FloorTodayCard({ signedIn }) {
  const { t } = useTranslation();
  if (!signedIn || signedIn.count === 0) return null;
  const k = (key, opts) => t(`staffDashboard.insights.floor.${key}`, opts);

  return (
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{k('title')}</h2>
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
    </Card>
  );
}
