import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import RecentActivity from './RecentActivity.jsx';

export default function SystemLogsWidget({ recentActivity }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Card className="bg-danger/5 border-danger/20">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-danger flex items-center gap-2">
          <span>{t('staffDashboard.widgets.systemLogs.title')}</span>
        </h2>
        <p className="text-xs text-muted-foreground mb-3">{t('staffDashboard.widgets.systemLogs.body')}</p>
        <div className="flex gap-2">
          <a href={import.meta.env.VITE_SENTRY_URL ?? '#'} target="_blank" rel="noreferrer" className="text-xs font-medium text-danger hover:underline">
            {t('staffDashboard.widgets.systemLogs.viewLogs')}
          </a>
        </div>
      </Card>
      <RecentActivity items={recentActivity} />
    </div>
  );
}
