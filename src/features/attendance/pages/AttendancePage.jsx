/**
 * Attendance page — tabs: Records (week/month grid, everyone's Present/
 * Absent/Leave/Sick/Off — click-to-correct for writers, plus the "mark all
 * present" bulk action folded in from the old Mark tab), Sign In/Out (one
 * merged sign-in/sign-out log + self-punch card), and Office Location
 * (geofence config). Summary lives at /attendance/summary, reachable from
 * the dashboard, not in this tab bar.
 *
 * Each tab is its own Section Access key now (split off the single
 * 'attendanceManage' key 2026-09-13: 'attendanceRecords' /
 * 'attendanceSignInOut' / 'attendanceOfficeLocation' — see
 * sectionAccess.service.js) — a login only sees the tabs it can actually
 * read, e.g. a Coordinator who can self-mark but not correct others' records
 * sees only Sign In/Out; someone granted only Office Location sees only
 * that. The page itself is reachable as long as at least one of the three
 * is readable (see router.jsx's guarded() call for this route).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { cn } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import RecordsGrid from '../components/RecordsGrid.jsx';
import SignInOutTab from '../components/SignInOutTab.jsx';
import OfficeLocationSettings from '../components/OfficeLocationSettings.jsx';

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canReadRecords = user.role === 'Admin' || Boolean(user.sectionAccess?.includes('attendanceRecords'));
  const canReadSignInOut = user.role === 'Admin' || Boolean(user.sectionAccess?.includes('attendanceSignInOut'));
  const canReadOffice = user.role === 'Admin' || Boolean(user.sectionAccess?.includes('attendanceOfficeLocation'));

  const tabs = [
    ...(canReadRecords ? [{ key: 'records', label: t('staffAttendance.tabs.records') }] : []),
    ...(canReadSignInOut ? [{ key: 'signinout', label: t('staffAttendance.tabs.signInOut') }] : []),
    ...(canReadOffice ? [{ key: 'office', label: t('staffAttendance.tabs.officeLocation') }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffAttendance.title')}
        description={t('staffAttendance.description')}
        onBack={() => navigate(-1)}
      />

      {/* overflow-y-hidden is load-bearing, not decorative — see Tabs.jsx's
          doc comment: overflow-x-auto alone forces the y-axis to 'auto' too,
          growing a real native scrollbar the moment this row is a sub-pixel
          taller than its own shrink-wrapped height. */}
      <div className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === tabItem.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
            )}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'records' && <RecordsGrid />}
      {tab === 'signinout' && <SignInOutTab />}
      {tab === 'office' && <OfficeLocationSettings />}
    </div>
  );
}
