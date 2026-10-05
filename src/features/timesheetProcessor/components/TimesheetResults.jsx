/**
 * TimesheetResults — the preview of a processed month: any parser warnings, the
 * monthly summary, and the day-by-day table. Reuses the shared Table primitive
 * so it inherits the app's desktop-table / mobile-card behavior for free.
 */
import { formatDate } from '../../../lib/utils.js';
import { minutesToHHMM, TIMESHEET_STATUS_META } from '../timesheet.constants.js';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';

/** A muted "00:00" so zero durations recede and real numbers stand out. */
function Duration({ minutes }) {
  const text = minutesToHHMM(minutes);
  return <span className={minutes ? '' : 'text-muted'}>{text}</span>;
}

// 2026-10-01, the user's own ask, matched against a real reference export:
// "No Attendance" (a day with zero device punches) now READS as "Absent" —
// display text only. The underlying status value, badge color, and summary
// field name are unchanged, so nothing elsewhere that keys off the raw
// string ('No Attendance') needs to know about this.
const STATUS_DISPLAY_LABEL = { 'No Attendance': 'Absent' };

const COLUMNS = [
  { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
  { key: 'day', header: 'Day', render: (r) => r.day, hideOnMobile: true },
  { key: 'login', header: 'Login', render: (r) => r.login ?? <span className="text-muted"></span> },
  { key: 'logout', header: 'Logout', render: (r) => r.logout ?? <span className="text-muted"></span> },
  { key: 'worked', header: 'Worked', render: (r) => <Duration minutes={r.workedMinutes} /> },
  { key: 'required', header: 'Required', render: (r) => <Duration minutes={r.requiredMinutes} />, hideOnMobile: true },
  { key: 'deficiency', header: 'Deficiency', render: (r) => <Duration minutes={r.deficiencyMinutes} /> },
  { key: 'overtime', header: 'Overtime', render: (r) => <Duration minutes={r.overtimeMinutes} /> },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={TIMESHEET_STATUS_META[r.status]?.variant ?? 'default'}>
        {STATUS_DISPLAY_LABEL[r.status] ?? r.status}
      </Badge>
    ),
  },
];

/** One labelled figure in the summary grid. */
function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default function TimesheetResults({ result, onExport, exporting }) {
  const s = result.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {result.employee.fullName}{' '}
            <span className="font-normal text-muted">({result.employee.employeeId})</span>
          </h2>
          <p className="text-sm text-muted">
            {result.monthName} {result.year} · required {minutesToHHMM(result.requiredMinutes)}/day
          </p>
        </div>
        <Button onClick={onExport} isLoading={exporting}>
          Export Excel
        </Button>
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">
            Processed with {result.warnings.length} note{result.warnings.length > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text/80">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Monthly summary
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Working Days" value={s.workingDays} />
          <Stat label="Holidays" value={s.holidayDays} />
          <Stat label="Present Days" value={s.presentDays} />
          <Stat label="Single Punch" value={s.singlePunchDays} />
          <Stat label="Absent" value={s.noAttendanceDays} />
          <Stat label="Total Worked" value={minutesToHHMM(s.totalWorkedMinutes)} />
          <Stat label="Total Required" value={minutesToHHMM(s.totalRequiredMinutes)} />
          <Stat label="Total Deficiency" value={minutesToHHMM(s.totalDeficiencyMinutes)} />
          <Stat label="Total Overtime" value={minutesToHHMM(s.totalOvertimeMinutes)} />
        </dl>
      </Card>

      <Table columns={COLUMNS} rows={result.rows} rowKey={(r) => r.date} />
    </div>
  );
}
