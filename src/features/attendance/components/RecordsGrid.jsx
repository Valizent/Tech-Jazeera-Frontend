/**
 * Records grid — the weekly/monthly view. Rows are workers, columns are days;
 * each cell shows the day's status as a coloured letter. The grid scrolls
 * horizontally inside its own container so the page never does.
 *
 * Two row groups: workers (Employee-based Attendance, click any cell to
 * correct) and, for Admin/Manager/HR, a read-only "Coordinators & Staff"
 * group below (StaffAttendance — a separate collection by design, see
 * server/src/modules/staffAttendance/staffAttendance.model.js; merged here
 * for display only, never combined into one lookup keyed by bare id).
 *
 * A worker cell with no real record but whose weekly off day matches the
 * column shows an INFERRED "Off" — visually distinct, never written to the
 * database. A real record for that day always wins over the inference.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listEmployees } from '../../employees/employees.api.js';
import { listStaffUsers } from '../../users/users.api.js';
import { listAttendance, adjustAttendance, markBulk } from '../attendance.api.js';
import { listAllStaffAttendance } from '../staffAttendance.api.js';
import { listHolidays } from '../../holidays/holidays.api.js';
import {
  monthRange,
  weekRange,
  addMonths,
  addDays,
  monthLabel,
  dayHeader,
  isWeekend,
  dayOfWeek,
  todayKey,
} from '../attendance.dates.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUSES,
  ATTENDANCE_WRITE_ROLES,
  STAFF_SELF_ATTENDANCE_ROLES,
  HOLIDAY_DISPLAY_META,
} from '../../../lib/constants.js';
import { cn, formatHours, apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';

/** ISO datetime -> "HH:MM" in the viewer's local time, for a time input. */
function toTimeInput(iso) {
  if (!iso) return '';
  return new Date(iso).toTimeString().slice(0, 5);
}

/** "YYYY-MM-DD" + "HH:MM" (local) -> ISO datetime, or null if no time given. */
function toIsoDateTime(dateKey, timeInput) {
  if (!timeInput) return null;
  return new Date(`${dateKey}T${timeInput}:00`).toISOString();
}

export default function RecordsGrid() {
  const toast = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = Boolean(user.sectionAccess?.includes('attendanceManage'));
  const canSeeStaffRows = ATTENDANCE_WRITE_ROLES.includes(user.role);

  const [mode, setMode] = useState('month'); // 'month' | 'week'
  const [ref, setRef] = useState(todayKey());
  const [editing, setEditing] = useState(null); // { employeeId, employeeName, date, status, checkIn, checkOut, note }
  const [markAllOpen, setMarkAllOpen] = useState(false);

  const range = useMemo(() => (mode === 'month' ? monthRange(ref) : weekRange(ref)), [mode, ref]);

  const { data: employeeData, isPending: employeesLoading } = useQuery({
    queryKey: ['employees', { forAttendance: true }],
    // Not filtered by type server-side — the grid tracks the supplied
    // workforce (Client + Subcontracted), filtered client-side below.
    // Own-type employees (Manager/HR/Coordinator/Accounts) already have
    // their own section below, sourced from StaffAttendance, not this
    // Attendance query.
    queryFn: () => listEmployees({ limit: 100, sortBy: 'fullName', sortOrder: 'asc' }),
  });
  const { data: records, isPending: recordsLoading } = useQuery({
    queryKey: ['attendance', 'range', range.from, range.to],
    queryFn: () => listAttendance({ from: range.from, to: range.to }),
  });
  const { data: staffUsers } = useQuery({
    queryKey: ['users', 'staffRoster'],
    queryFn: () => listStaffUsers({}),
    enabled: canSeeStaffRows,
  });
  const { data: staffRecords } = useQuery({
    queryKey: ['staffAttendance', 'all', range.from, range.to],
    queryFn: () => listAllStaffAttendance({ from: range.from, to: range.to }),
    enabled: canSeeStaffRows,
  });
  const { data: holidays } = useQuery({
    queryKey: ['holidays', range.from, range.to],
    queryFn: () => listHolidays({ from: range.from, to: range.to }),
  });

  // Fast lookup: `${employeeId}|${dateKey}` → { status, source, hoursWorked, checkInTime, checkOutTime, note }.
  const employeeMarks = useMemo(() => {
    const map = {};
    for (const r of records ?? []) {
      map[`${r.employee._id}|${r.date.slice(0, 10)}`] = {
        status: r.status,
        source: r.source,
        hoursWorked: r.hoursWorked,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        note: r.note,
      };
    }
    return map;
  }, [records]);

  // Same shape, but keyed by User id — a separate map on purpose, never
  // merged with employeeMarks (Employee ids and User ids are different
  // collections; a shared unprefixed map would risk an accidental collision).
  const staffMarks = useMemo(() => {
    const map = {};
    for (const r of staffRecords ?? []) {
      if (!r.user) continue;
      map[`${r.user._id}|${r.date.slice(0, 10)}`] = {
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        hoursWorked: r.hoursWorked,
      };
    }
    return map;
  }, [staffRecords]);

  const workers = (employeeData?.items ?? []).filter((e) => e.type !== 'Own' && e.status !== 'Exited');
  const staffRows = canSeeStaffRows
    ? (staffUsers ?? []).filter((u) => STAFF_SELF_ATTENDANCE_ROLES.includes(u.role) && u.isActive)
    : [];

  /** The holiday (if any) covering this date key — a date-string range check, so it
   *  works the same whether the holiday is a single day or spans several. */
  function holidayFor(date) {
    return (holidays ?? []).find((h) => h.startDate.slice(0, 10) <= date && h.endDate.slice(0, 10) >= date) ?? null;
  }

  /** A real record always wins; otherwise infer a Holiday, then the employee's weekly off day. */
  function markFor(worker, date) {
    const explicit = employeeMarks[`${worker._id}|${date}`];
    if (explicit) return explicit;
    const holiday = holidayFor(date);
    if (holiday) return { status: 'Holiday', inferred: true, holidayName: holiday.name };
    if (worker.weeklyOffDay != null && dayOfWeek(date) === worker.weeklyOffDay) {
      return { status: 'Off', inferred: true };
    }
    return null;
  }

  const shift = (dir) => setRef((r) => (mode === 'month' ? addMonths(r, dir) : addDays(r, dir * 7)));

  function openEditor(worker, date) {
    if (!canEdit) return;
    const mark = markFor(worker, date);
    setEditing({
      employeeId: worker._id,
      employeeName: worker.fullName,
      date,
      // Only a real, selectable status pre-fills the form — an inferred
      // Holiday isn't one of ATTENDANCE_STATUSES, so it'd render as an
      // invalid <select> value.
      status: mark && ATTENDANCE_STATUSES.includes(mark.status) ? mark.status : 'Present',
      checkIn: toTimeInput(mark?.checkInTime),
      checkOut: toTimeInput(mark?.checkOutTime),
      note: mark?.note ?? '',
    });
  }

  const adjustMutation = useMutation({
    mutationFn: adjustAttendance,
    onSuccess: () => {
      toast.success(t('staffAttendance.records.updatedSuccess'));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function saveEdit() {
    adjustMutation.mutate({
      employee: editing.employeeId,
      date: editing.date,
      status: editing.status,
      checkInTime: toIsoDateTime(editing.date, editing.checkIn),
      checkOutTime: toIsoDateTime(editing.date, editing.checkOut),
      note: editing.note,
    });
  }

  // "Mark all Present" — folded in from the old Mark tab. Only offered when
  // today is actually a visible column, and skips anyone whose configured
  // weekly off day is today, so it can't silently overwrite a deliberate
  // off day (a real day-off worked as comp-time is still one click away via
  // the per-cell editor).
  const today = todayKey();
  const markAllCandidates = workers.filter((w) => w.weeklyOffDay == null || dayOfWeek(today) !== w.weeklyOffDay);
  const showMarkAll = canEdit && range.days.includes(today) && markAllCandidates.length > 0;

  const markAllMutation = useMutation({
    mutationFn: () =>
      markBulk({
        date: today,
        records: markAllCandidates.map((w) => ({ employee: w._id, status: 'Present' })),
      }),
    onSuccess: (res) => {
      toast.success(t('staffAttendance.records.markedPresentSuccess', { count: res.marked }));
      setMarkAllOpen(false);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setMarkAllOpen(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {['month', 'week'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                mode === m ? 'bg-primary text-white' : 'text-muted hover:text-text'
              )}
            >
              {t(`staffAttendance.records.${m}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)}>
            {t('staffAttendance.records.prev')}
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium">
            {mode === 'month' ? monthLabel(ref) : `${range.from} → ${range.to}`}
          </span>
          <Button size="sm" variant="secondary" onClick={() => shift(1)}>
            {t('staffAttendance.records.next')}
          </Button>
          {showMarkAll && (
            <Button size="sm" variant="secondary" onClick={() => setMarkAllOpen(true)}>
              {t('staffAttendance.records.markAllPresent')}
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {Object.entries(ATTENDANCE_STATUS_META).map(([status, meta]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('grid h-5 w-5 place-items-center rounded text-[10px] font-bold', meta.cell)}>
              {meta.letter}
            </span>
            {t(`common.status.${status}`, status)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold bg-border/25 text-muted/70 ring-1 ring-inset ring-border/40">
            F
          </span>
          {t('staffAttendance.records.legendInferredOff')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold bg-border/25 text-muted/70 ring-1 ring-inset ring-border/40">
            {HOLIDAY_DISPLAY_META.letter}
          </span>
          {t('staffAttendance.records.legendHoliday')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-block h-3 w-3">
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-surface" />
          </span>
          {t('staffAttendance.records.legendSelfMarked')}
        </span>
        {canEdit && <span>{t('staffAttendance.records.clickToCorrect')}</span>}
      </div>

      {employeesLoading || recordsLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-muted">
                  {t('staffAttendance.records.worker')}
                </th>
                {range.days.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      'whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-muted',
                      isWeekend(d) && 'bg-bg/60'
                    )}
                  >
                    {dayHeader(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w._id} className="border-t border-border">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2">
                    <span className="font-medium">{w.fullName}</span>
                    <span className="block text-xs text-muted">{w.employeeId}</span>
                  </td>
                  {range.days.map((d) => {
                    const mark = markFor(w, d);
                    const meta = mark
                      ? mark.status === 'Holiday'
                        ? HOLIDAY_DISPLAY_META
                        : ATTENDANCE_STATUS_META[mark.status]
                      : null;
                    // A completed self-marked shift has real hours to show —
                    // that's more useful to a manager than a plain "P".
                    const hasHours = mark?.hoursWorked != null;
                    const cellText = hasHours ? formatHours(mark.hoursWorked) : meta?.letter;
                    const cellTitle = mark
                      ? mark.status === 'Holiday'
                        ? t('staffAttendance.records.holidayTitle', { name: mark.holidayName })
                        : mark.inferred
                          ? t('staffAttendance.records.offTitle')
                          : [
                              t(`common.status.${mark.status}`, mark.status),
                              hasHours && t('staffAttendance.records.hoursSuffix', { hours: formatHours(mark.hoursWorked) }),
                              mark.source === 'self' && t('staffAttendance.records.selfMarked'),
                            ]
                              .filter(Boolean)
                              .join(' · ')
                      : canEdit
                        ? t('staffAttendance.records.clickToAdd')
                        : undefined;
                    return (
                      <td key={d} className={cn('p-0 text-center', isWeekend(d) && 'bg-bg/40')}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => openEditor(w, d)}
                          title={cellTitle}
                          className={cn(
                            'flex h-10 w-full items-center justify-center',
                            canEdit && 'cursor-pointer hover:bg-primary/[0.06]'
                          )}
                        >
                          {meta ? (
                            <span
                              className={cn(
                                'relative inline-grid h-6 min-w-[1.6rem] place-items-center rounded px-1 font-bold',
                                hasHours ? 'text-[9px]' : 'text-[11px]',
                                mark.inferred
                                  ? 'bg-border/25 text-muted/70 ring-1 ring-inset ring-border/40'
                                  : meta.cell
                              )}
                            >
                              {cellText}
                              {/* Self-marked (Worker GPS/office-network check-in, P2-M3) vs staff-marked. */}
                              {mark.source === 'self' && (
                                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-surface" />
                              )}
                            </span>
                          ) : (
                            <span className="text-muted/30">·</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {staffRows.length > 0 && (
                <tr className="border-t border-border bg-bg/60">
                  <td
                    colSpan={range.days.length + 1}
                    className="sticky left-0 z-10 bg-bg/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    {t('staffAttendance.records.coordinatorsAndStaff')}
                  </td>
                </tr>
              )}
              {staffRows.map((u) => (
                <tr key={`staff-${u._id}`} className="border-t border-border">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2">
                    <span className="font-medium">{u.name}</span>
                    <span className="block text-xs text-muted">{u.role}</span>
                  </td>
                  {range.days.map((d) => {
                    const mark = staffMarks[`${u._id}|${d}`];
                    const hasHours = mark?.hoursWorked != null;
                    const signedIn = Boolean(mark?.checkInTime) && !mark?.checkOutTime;
                    const cellText = hasHours ? formatHours(mark.hoursWorked) : signedIn ? t('staffAttendance.records.signedInStatus') : null;
                    const cellTitle = hasHours
                      ? t('staffAttendance.records.hoursSelfMarkedTitle', { hours: formatHours(mark.hoursWorked) })
                      : signedIn
                        ? t('staffAttendance.records.signedInNotOutTitle')
                        : undefined;
                    return (
                      <td key={d} className={cn('p-0 text-center', isWeekend(d) && 'bg-bg/40')}>
                        <div title={cellTitle} className="flex h-10 w-full items-center justify-center">
                          {cellText ? (
                            <span
                              className={cn(
                                'inline-grid h-6 min-w-[1.6rem] place-items-center rounded px-1 font-bold',
                                hasHours ? 'text-[9px]' : 'text-[11px]',
                                hasHours ? 'bg-border/60 text-muted' : 'bg-primary/15 text-primary'
                              )}
                            >
                              {cellText}
                            </span>
                          ) : (
                            <span className="text-muted/30">·</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? t('staffAttendance.records.editorTitle', { name: editing.employeeName, date: editing.date }) : ''}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
            className="space-y-4"
          >
            <Select
              label={t('staffAttendance.records.status')}
              value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value })}
            >
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`common.status.${s}`, s)}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('staffAttendance.records.checkInTime')}
                type="time"
                value={editing.checkIn}
                onChange={(e) => setEditing({ ...editing, checkIn: e.target.value })}
              />
              <Input
                label={t('staffAttendance.records.checkOutTime')}
                type="time"
                value={editing.checkOut}
                onChange={(e) => setEditing({ ...editing, checkOut: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted">{t('staffAttendance.records.timesHint')}</p>
            <Textarea
              label={t('staffAttendance.records.note')}
              value={editing.note}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={adjustMutation.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={markAllOpen}
        title={t('staffAttendance.records.markAllTitle')}
        message={t('staffAttendance.records.markAllMessage', { count: markAllCandidates.length, date: today })}
        confirmLabel={t('staffAttendance.records.markAllPresent')}
        loading={markAllMutation.isPending}
        onConfirm={() => markAllMutation.mutate()}
        onCancel={() => setMarkAllOpen(false)}
      />
    </div>
  );
}
