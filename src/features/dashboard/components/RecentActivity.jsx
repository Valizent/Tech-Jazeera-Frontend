/**
 * RecentActivity — the latest audit-log entries as a human-readable feed.
 * The full, filterable, paginated trail lives on the Security Log page
 * (Admin-only) — this widget is just the newest 8, for a glance. Rendered
 * only when the viewer has real `auditLog` read access (see
 * dashboard.service.js/DashboardPage.jsx) — not a hardcoded role list.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { timeAgo } from '../../../lib/utils.js';
import { describeAction } from '../../../lib/auditActions.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function RecentActivity({ items }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Defensive: every current caller always passes an array, but this widget
  // shouldn't crash the page if a future caller ever passes null/undefined.
  const safeItems = items ?? [];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.recentActivity.title')}</h2>
        {/* FIX (2026-09-22): this used to be `user.role === 'Admin'` — the widget's own
            doc comment above already promises real `auditLog` Section Access, not a
            hardcoded role list, but this one link inside it never followed that: an
            Admin could grant auditLog read to anyone (the /security-log route already
            enforces exactly that grant, correctly) and this link would still never
            appear for them, even though the page itself was one click away by URL. */}
        {user.sectionAccess?.includes('auditLog') && (
          <Link to="/security-log" className="text-xs font-medium text-primary hover:underline">
            {t('staffDashboard.recentActivity.viewFullLog')}
          </Link>
        )}
      </div>
      {safeItems.length === 0 ? (
        <EmptyState title={t('staffDashboard.recentActivity.empty')} description={t('staffDashboard.recentActivity.emptyDescription')} />
      ) : (
        <ul className="space-y-3">
          {safeItems.map((a) => (
            <li key={a._id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span className="flex-1">
                <span className="font-medium">{a.user?.name ?? 'System'}</span>{' '}
                <span className="text-muted">{describeAction(a.action)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{timeAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
