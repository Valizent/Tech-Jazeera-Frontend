import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';

export default function DirectoryStatsWidget({ activeClients, activeSubcontractors }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="flex flex-col items-center justify-center py-6">
        <span className="text-3xl font-bold text-text">{activeClients ?? 0}</span>
        <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.stats.activeClients')}</span>
      </Card>
      <Card className="flex flex-col items-center justify-center py-6">
        <span className="text-3xl font-bold text-text">{activeSubcontractors ?? 0}</span>
        <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDashboard.widgets.activeSubcontractors')}</span>
      </Card>
    </div>
  );
}
