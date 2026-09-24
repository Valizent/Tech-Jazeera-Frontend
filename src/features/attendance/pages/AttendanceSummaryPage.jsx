/**
 * Attendance Summary page — per-worker status counts + Excel/PDF export.
 * Reached from the dashboard's "Marked today" stat, not from the Attendance
 * tab bar — it's a monthly/reporting view, not a daily-operations one.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import SummaryTab from '../components/SummaryTab.jsx';

export default function AttendanceSummaryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffAttendance.summary.pageTitle')}
        description={t('staffAttendance.summary.pageDescription')}
        // Fixed destination, not browser history — this page is only ever
        // reached from the Dashboard's "Marked today" stat (see the file
        // comment), so "back" here means the related Attendance page, not
        // wherever the visitor actually came from. `replace: true` (fixed
        // 2026-09-24, a real user-reported loop): AttendancePage's own back
        // button uses plain history (`navigate(-1)`) — a normal (pushing)
        // navigate() here left BOTH pages on the stack, so its "back" landed
        // right back on this page. Replacing this entry means there's only
        // ever one /attendance in the stack, so its own back correctly goes
        // past it to wherever this page's own visitor really came from.
        onBack={() => navigate('/attendance', { replace: true })}
      />
      <SummaryTab />
    </div>
  );
}
