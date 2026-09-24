/**
 * MyRequirementsWidget — a coordinator's own open pre-mobilisation Requirement
 * cards, by stage. Fills the dashboard slot beside HR Compliance Actions that
 * used to sit empty for a Coordinator (StandbyAnalysisWidget needs `payroll`
 * read, which a Coordinator never has by default — see DashboardPage.jsx's own
 * doc comment on why every 2-col row there now pairs two Coordinator-visible
 * widgets instead) — 2026-09-24, a real user ask. Unlike HrComplianceWidget,
 * this always renders (even at zero) rather than hiding — "no open
 * requirements" is itself useful information for a pipeline summary, and
 * hiding it would reopen the exact empty-column gap this widget exists to fix.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';

export default function MyRequirementsWidget({ summary }) {
  const { t } = useTranslation();
  const { total, byStage } = summary;

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.myRequirements.title')}</h2>
        <Link to="/requirements" className="shrink-0 text-xs font-medium text-primary hover:underline">
          {t('staffDashboard.widgets.myRequirements.viewBoard')}
        </Link>
      </div>

      <p className="text-3xl font-bold text-text">{total}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.myRequirements.openCards')}</p>

      {total > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {byStage.map((s) => (
            <span key={s.stage} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {s.stage} · {s.count}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t('staffDashboard.widgets.myRequirements.emptyDescription')}</p>
      )}
    </Card>
  );
}
