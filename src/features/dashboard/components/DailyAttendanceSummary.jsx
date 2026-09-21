import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils.js';

export default function DailyAttendanceSummary({ summary }) {
  const { t } = useTranslation();
  
  if (!summary) return null;

  const items = [
    { label: 'Staff', count: summary.staff, color: 'text-primary' },
    { label: 'BDMs', count: summary.bdm, color: 'text-success' },
    { label: 'Coordinators', count: summary.coordinator, color: 'text-warning' },
    { label: 'Standby Workers', count: summary.standby, color: 'text-danger' }
  ];

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Daily Attendance Summary</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center justify-center rounded-lg border border-border bg-bg/50 p-3">
            <span className={cn('text-2xl font-bold', item.color)}>{item.count}</span>
            <span className="mt-1 text-center text-xs font-medium text-muted">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
