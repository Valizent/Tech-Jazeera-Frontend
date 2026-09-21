import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils.js';

export default function HrComplianceWidget({ pendingLeave, pendingExit }) {
  const items = [
    { label: 'Pending Leave', count: pendingLeave ?? 0, link: '/leave' },
    { label: 'Pending Exits', count: pendingExit ?? 0, link: '/exit-documents' }
  ];

  if ((pendingLeave ?? 0) === 0 && (pendingExit ?? 0) === 0) {
    return null; // hide if nothing actionable
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">HR Compliance Actions</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.link}
            className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/5"
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', item.count > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
