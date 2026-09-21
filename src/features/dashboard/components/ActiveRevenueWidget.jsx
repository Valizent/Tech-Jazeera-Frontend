import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney } from '../../../lib/utils.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function ActiveRevenueWidget({ revenue }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isCoordinator = user.role === 'Coordinator';

  if (revenue == null) return null;

  return (
    <Card className="flex flex-col h-full justify-center text-center py-6">
      <div className="rounded-lg border border-border bg-bg/50 p-6">
        <span className="block text-4xl font-bold text-success">{formatMoney(revenue)}</span>
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">
          {isCoordinator ? 'Your Active Mobilisation Revenue' : 'Company Active Mobilisation Revenue'}
        </span>
        <p className="mt-1 text-xs text-muted">
          Based on mobilisations active at any point this month
        </p>
      </div>
    </Card>
  );
}
