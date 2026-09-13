/**
 * Sign In/Out tab — replaces the old My Attendance / Time Log / Staff
 * Attendance split with one screen: a punch card (only for whoever holds
 * 'attendanceSignInOut' Write — self-mark eligibility, admin-configurable;
 * Admin is exempt by design, Workers have their own equivalent in the ESS
 * portal) on top, and one merged chronological log below combining
 * Employee-based Attendance with User-based StaffAttendance (the staff rows
 * only for whoever holds 'attendanceSignInOut' Read — Write always implies
 * Read, so every self-marker sees them too).
 *
 * The two sources are never combined into one bare-id lookup — every row
 * carries a `kind` discriminator and its own record `_id` as the row key.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAttendance } from '../attendance.api.js';
import { listAllStaffAttendance, listMyStaffAttendance, punchStaffAttendance } from '../staffAttendance.api.js';
import { todayKey } from '../attendance.dates.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useDeviceLocation } from '../../../lib/useDeviceLocation.js';
import { ATTENDANCE_STATUS_META } from '../../../lib/constants.js';
import { apiMessage, formatDate, formatHours, formatTime } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** The punch card — whoever holds 'attendanceSignInOut' Write signs themselves in/out here. */
function PunchCard() {
  const toast = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { locating, getLocation } = useDeviceLocation();
  const VERIFIED_LABEL = {
    geofence: t('staffAttendance.signInOut.verifiedByLocation'),
    officeIp: t('staffAttendance.signInOut.verifiedByOfficeNetwork'),
  };

  const { data } = useQuery({
    queryKey: ['staffAttendance', 'mine'],
    queryFn: () => listMyStaffAttendance({}),
  });

  const todayRecord = (data ?? []).find((r) => r.date.slice(0, 10) === todayKey());
  const hasPunchedToday = Boolean(todayRecord?.checkInTime);
  const signedInNotOut = hasPunchedToday && !todayRecord?.checkOutTime;

  async function punchWithLocation() {
    punchMutation.mutate((await getLocation()) ?? {});
  }

  const punchMutation = useMutation({
    mutationFn: punchStaffAttendance,
    onSuccess: ({ action, record }) => {
      toast.success(
        action === 'checked-in'
          ? t('staffAttendance.signInOut.signedIn')
          : t('staffAttendance.signInOut.signedOut', { hours: formatHours(record.hoursWorked) })
      );
      queryClient.invalidateQueries({ queryKey: ['staffAttendance'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const busy = locating || punchMutation.isPending;

  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {signedInNotOut ? (
          <Badge variant="success" className="text-sm">
            {t('staffAttendance.signInOut.signedInAt', { time: formatTime(todayRecord.checkInTime) })}
          </Badge>
        ) : hasPunchedToday ? (
          <>
            <Badge variant="default" className="text-sm">
              {t('staffAttendance.signInOut.signedOutAt', { time: formatTime(todayRecord.checkOutTime) })}
            </Badge>
            <p className="text-xs text-muted">
              {t('staffAttendance.signInOut.hoursToday', {
                hours: formatHours(todayRecord.hoursWorked),
                verifiedBy: VERIFIED_LABEL[todayRecord.verifiedBy] ?? t('staffAttendance.signInOut.selfMarked'),
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">{t('staffAttendance.signInOut.notSignedInToday')}</p>
        )}

        {signedInNotOut ? (
          <Button onClick={punchWithLocation} isLoading={busy} size="lg" variant="secondary" className="w-full sm:w-auto">
            {t('staffAttendance.signInOut.signOut')}
          </Button>
        ) : (
          <Button onClick={punchWithLocation} isLoading={busy} size="lg" className="w-full sm:w-auto">
            {hasPunchedToday ? t('staffAttendance.signInOut.signInAgain') : t('staffAttendance.signInOut.signIn')}
          </Button>
        )}
        <p className="max-w-sm text-xs text-muted">{t('staffAttendance.signInOut.punchHint')}</p>
      </div>
    </Card>
  );
}

export default function SignInOutTab() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canSeeStaffRows = Boolean(user.sectionAccess?.includes('attendanceSignInOut'));
  const showPunchCard = Boolean(user.sectionAccessWrite?.includes('attendanceSignInOut'));

  const today = todayKey();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const rangeValid = Boolean(from && to && from <= to);

  const { data: employeeRecords, isPending: employeePending, isError: employeeError } = useQuery({
    queryKey: ['attendance', 'range', from, to],
    queryFn: () => listAttendance({ from, to }),
    enabled: rangeValid,
  });
  const { data: staffRecords, isPending: staffPending, isError: staffError } = useQuery({
    queryKey: ['staffAttendance', 'all', from, to],
    queryFn: () => listAllStaffAttendance({ from, to }),
    enabled: rangeValid && canSeeStaffRows,
  });

  const isPending = employeePending || (canSeeStaffRows && staffPending);
  const isError = employeeError || staffError;

  // Newest day first, then alphabetically within a day.
  const rows = useMemo(() => {
    const employeeRows = (employeeRecords ?? []).map((r) => ({
      kind: 'employee',
      id: r._id,
      name: r.employee.fullName,
      subLabel: r.employee.employeeId,
      date: r.date,
      status: r.status,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      hoursWorked: r.hoursWorked,
      source: r.source,
    }));
    const staffRows = (staffRecords ?? []).map((r) => ({
      kind: 'staff',
      id: r._id,
      name: r.user?.name ?? t('common.notAssigned'),
      subLabel: r.user?.role,
      date: r.date,
      status: null, // StaffAttendance has no status field
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      hoursWorked: r.hoursWorked,
      source: 'self', // no staff-correction path exists for StaffAttendance
    }));
    return [...employeeRows, ...staffRows].sort((a, b) => {
      const dateDiff = b.date.slice(0, 10).localeCompare(a.date.slice(0, 10));
      return dateDiff !== 0 ? dateDiff : a.name.localeCompare(b.name);
    });
  }, [employeeRecords, staffRecords]);

  const columns = [
    {
      key: 'who',
      header: t('staffAttendance.signInOut.columns.name'),
      render: (r) => (
        <span className="font-medium text-text">
          {r.name}
          <span className="block text-xs font-normal text-muted">{r.subLabel}</span>
        </span>
      ),
    },
    { key: 'date', header: t('staffAttendance.signInOut.columns.date'), render: (r) => formatDate(r.date) },
    {
      key: 'status',
      header: t('staffAttendance.signInOut.columns.status'),
      render: (r) =>
        r.status ? (
          <Badge variant={ATTENDANCE_STATUS_META[r.status]?.variant ?? 'default'}>{t(`common.status.${r.status}`, r.status)}</Badge>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'checkIn', header: t('staffAttendance.signInOut.columns.signIn'), className: 'tabular-nums', render: (r) => formatTime(r.checkInTime) },
    { key: 'checkOut', header: t('staffAttendance.signInOut.columns.signOut'), className: 'tabular-nums', render: (r) => formatTime(r.checkOutTime) },
    {
      key: 'hours',
      header: t('staffAttendance.signInOut.columns.hours'),
      className: 'text-center tabular-nums',
      render: (r) => formatHours(r.hoursWorked),
    },
    {
      key: 'source',
      header: t('staffAttendance.signInOut.columns.markedBy'),
      hideOnMobile: true,
      render: (r) => (r.source === 'self' ? t('staffAttendance.signInOut.self') : t('staffAttendance.signInOut.staff')),
    },
  ];

  return (
    <div className="space-y-6">
      {showPunchCard && <PunchCard />}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-3">
            <Input label={t('staffAttendance.signInOut.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:max-w-[170px]" />
            <Input label={t('staffAttendance.signInOut.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:max-w-[170px]" />
          </div>
          <p className="text-xs text-muted">{t('staffAttendance.signInOut.rangeHint')}</p>
        </div>

        {!rangeValid ? (
          <EmptyState title={t('staffAttendance.signInOut.invalidRange')} description={t('staffAttendance.signInOut.invalidRangeDescription')} />
        ) : isError ? (
          <EmptyState title={t('staffAttendance.signInOut.couldNotLoad')} description={t('common.checkConnection')} />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => `${r.kind}-${r.id}`}
            loading={isPending}
            emptyState={
              <EmptyState
                title={t('staffAttendance.signInOut.emptyTitle')}
                description={t('staffAttendance.signInOut.emptyDescription')}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
