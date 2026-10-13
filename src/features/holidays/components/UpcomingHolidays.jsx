/**
 * UpcomingHolidays — a compact "what's coming up" list on the Worker's My
 * Leave page. Read-only; managing the calendar itself happens on the dedicated
 * Holidays page.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listHolidays } from '../holidays.api.js';
import { formatDate } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

const MAX_SHOWN = 5;

export default function UpcomingHolidays() {
  const { t } = useTranslation();
  const { data: holidays, isPending } = useQuery({
    queryKey: ['holidays', 'upcoming'],
    queryFn: () => listHolidays({ from: new Date().toISOString().slice(0, 10) }),
  });

  if (isPending) return <Skeleton className="h-16 w-full" />;
  if (!holidays || holidays.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('leave.upcomingHolidays')}</h2>
      <ul className="space-y-2">
        {holidays.slice(0, MAX_SHOWN).map((h) => (
          <li key={h._id} className="flex items-center justify-between gap-3 text-sm">
            <span>{h.name}</span>
            <span className="text-xs text-muted">
              {h.startDate.slice(0, 10) === h.endDate.slice(0, 10)
                ? formatDate(h.startDate)
                : `${formatDate(h.startDate)} – ${formatDate(h.endDate)}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
