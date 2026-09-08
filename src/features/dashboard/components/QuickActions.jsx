/**
 * QuickActions — shortcuts to the common create flows, shown only for the
 * actions the current user is admin-granted (Section Access — see
 * sectionAccess.model.js); the API still enforces them.
 *
 * `addEmployee` previously checked EMPLOYEE_WRITE_ROLES (Admin/Manager/HR —
 * the EDIT circle) instead of the real 'employeeCreate' gate (Admin only by
 * default) — a real pre-existing mismatch found while migrating this file's
 * other actions onto Section Access, fixed here too.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import Card from '../../../components/ui/Card.jsx';

const ACTIONS = [
  { labelKey: 'staffDashboard.quickActions.addEmployee', to: '/employees/new', sectionKey: 'employeeCreate' },
  { labelKey: 'staffDashboard.quickActions.addClient', to: '/clients/new', sectionKey: 'clientsManage' },
  { labelKey: 'staffDashboard.quickActions.newMobilisation', to: '/mobilisations/new', sectionKey: 'mobilisationsSelfMobilise' },
  { labelKey: 'staffDashboard.quickActions.attendance', to: '/attendance', sectionKey: 'attendanceManage' },
  { labelKey: 'staffDashboard.quickActions.newQuotation', to: '/quotations/new', sectionKey: 'quotationsManage' },
];

export default function QuickActions() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const available = ACTIONS.filter((a) => user.sectionAccess?.includes(a.sectionKey));
  if (available.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.quickActions.title')}</h2>
      <div className="flex flex-wrap gap-2">
        {available.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            {t(a.labelKey)}
          </Link>
        ))}
      </div>
    </Card>
  );
}
