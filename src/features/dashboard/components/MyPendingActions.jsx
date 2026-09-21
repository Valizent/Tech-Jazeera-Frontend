/**
 * MyPendingActions — "things waiting on you specifically," across every
 * approval-hierarchy-integrated request type (Leave/Timesheet/Salary
 * Advance/Reimbursement/Mobilisation). Server-computed via the same
 * annotateCanDecide authorization check the review-queue pages use (see
 * dashboard.service.js's getMyPendingActions) — never a company-wide count,
 * always "yours to act on." Also carries two Coordinator Workflow rows —
 * "Stale requirements" and "Open tasks" — each scoped by its own module to
 * what this viewer can see (a coordinator's own; a manager with team access,
 * everyone's), so a row's number always matches the page it links to.
 * Hidden entirely when empty, same pattern as the other conditional
 * dashboard widgets.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';

export default function MyPendingActions({ items }) {
  const { t } = useTranslation();
  const safeItems = items ?? [];
  if (safeItems.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.waitingOnYou')}</h2>
      <ul className="space-y-2">
        {safeItems.map((item) => (
          <li key={item.url + item.label}>
            <Link
              to={item.url}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-muted/50 hover:bg-border/20"
            >
              <span className="font-medium text-text">{t(`staffDashboard.pendingModules.${item.label}`, item.label)}</span>
              <span className="flex items-center gap-2 text-primary">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {item.count}
                </span>
                {t('staffDashboard.review')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
