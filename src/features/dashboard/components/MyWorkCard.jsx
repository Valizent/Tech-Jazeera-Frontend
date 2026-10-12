/**
 * MyWorkCard: "what needs me today". The stale requirement cards, the
 * deployments missing a timesheet, my mobilisations sitting with a reviewer
 * (and which reviewer), and my open tasks soonest-due first. The counts
 * already live on the "Waiting on you" card; this puts names next to them.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import { formatDate, formatMonthYear } from '../../../lib/utils.js';

function Group({ title, count, to, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title} · {count}
        </h3>
        {to && (
          <Link to={to} className="text-xs font-medium text-primary hover:underline">
            →
          </Link>
        )}
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

export default function MyWorkCard({ work }) {
  const { t } = useTranslation();
  if (!work) return null;
  const { staleRequirements, missingTimesheets, awaitingReview, tasks } = work;
  const k = (key, opts) => t(`staffDashboard.insights.myWork.${key}`, opts);
  const empty = !staleRequirements.length && !missingTimesheets.count && !awaitingReview?.length && !tasks.length;
  if (empty) return null;

  return (
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{k('title')}</h2>
      <div className="space-y-5">
        {tasks.length > 0 && (
          <Group title={k('tasks')} count={tasks.length} to="/daily-updates?tab=tasks">
            {tasks.map((task) => (
              <li key={task._id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="truncate">{task.text}</span>
                {task.dueDate && (
                  <Badge variant={task.overdue ? 'danger' : 'default'}>{task.overdue ? k('overdue') : k('due', { date: formatDate(task.dueDate) })}</Badge>
                )}
              </li>
            ))}
          </Group>
        )}
        {awaitingReview?.length > 0 && (
          <Group title={k('awaiting')} count={awaitingReview.length} to="/mobilisations">
            {awaitingReview.map((m) => (
              <li key={m._id}>
                <Link to={`/mobilisations/${m._id}`} className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-primary">
                  <span className="truncate">
                    {m.workerName} · {m.clientName}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{k('waitingDays', { days: m.days, names: m.waitingOn.join(', ') })}</span>
                </Link>
              </li>
            ))}
          </Group>
        )}
        {staleRequirements.length > 0 && (
          <Group title={k('stale')} count={staleRequirements.length} to="/requirements">
            {staleRequirements.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="truncate">
                  {r.jobTitle} · {r.clientName}
                </span>
                <span className="shrink-0 text-xs text-muted">{k('inStage', { days: r.daysInStage, stage: r.stage })}</span>
              </li>
            ))}
          </Group>
        )}
        {missingTimesheets.count > 0 && (
          <Group title={k('missingTimesheets')} count={missingTimesheets.count} to="/mobilisations?status=Approved">
            {missingTimesheets.items.map((m) => (
              <li key={`${m.deploymentId}-${m.month}`}>
                <Link to={`/deployments/${m.deploymentId}`} className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-primary">
                  <span className="truncate">
                    {m.workerName} · {m.clientName}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatMonthYear(m.month)}</span>
                </Link>
              </li>
            ))}
            {missingTimesheets.count > missingTimesheets.items.length && (
              <li className="py-1.5 text-xs text-muted">{k('more', { count: missingTimesheets.count - missingTimesheets.items.length })}</li>
            )}
          </Group>
        )}
      </div>
    </Card>
  );
}
