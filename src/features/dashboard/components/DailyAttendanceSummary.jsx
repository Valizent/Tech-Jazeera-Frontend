import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils.js';

export default function DailyAttendanceSummary({ summary }) {
  const { t } = useTranslation();
  
  if (!summary) return null;

  return (
    <Card className="flex flex-col h-full justify-center text-center py-6">
      <Link 
        to="/attendance/summary" 
        className="group block rounded-lg border border-border bg-bg/50 p-6 transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        <span className="block text-4xl font-bold text-primary group-hover:text-primary/90">{summary.total}</span>
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted group-hover:text-primary/80">
          Daily Attendance
        </span>
      </Link>
    </Card>
  );
}
