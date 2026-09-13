/**
 * TimesheetsPage — a real, browsable monthly timesheet per internal staff
 * member, replacing the old weekly submit/review-queue workflow (rebuilt
 * 2026-09-13, the user's own instruction — see
 * docs/TIMESHEETS-MONTHLY-REPORT-notes.md for the full story, including
 * what this means for Payroll's overtime figure going forward, a
 * deliberately separate, not-yet-decided follow-up).
 *
 * Two views in one page (list → detail), same "drill in, breadcrumb back"
 * shape as the Section Access page:
 *  - List: every 'Own'-type employee (internal staff — Coordinator/HR/
 *    Manager/Accounts; a deployed/mobilised field worker has their own
 *    timesheet on the Deployment record instead, untouched by this).
 *  - Detail: pick a month, see every day of it — a real Attendance/
 *    StaffAttendance record always wins, otherwise Holiday, then the
 *    employee's own weeklyOffDay (see monthlyReport.service.js) — with a
 *    "Single Punch" day (signed in, never signed out) called out in its own
 *    color, then export the same data as an .xlsx (PDF is a later step,
 *    per the user's own "for now, Excel" instruction).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getMonthlyReport, generateMonthlyReport } from '../timesheets.api.js';
import { listEmployees } from '../../employees/employees.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Raw minutes (as the report sends per day) → "H:MM". A day with no worked
 *  time at all (Off/Holiday/No Attendance) renders as an em dash instead of
 *  "0:00", same convention formatHours() uses for a null hours figure. */
function minutesToHHMM(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** One badge variant per report status — 'Single Punch' deliberately shares
 *  'danger' with 'Absent' rather than 'warning' (which 'Deficient' already
 *  uses): a forgotten sign-out is exactly the kind of anomaly worth a strong
 *  color, and the badge's own text still disambiguates it from a real
 *  absence at a glance. */
const STATUS_VARIANT = {
  Holiday: 'default',
  Off: 'default',
  'No Attendance': 'default',
  Leave: 'default',
  Sick: 'default',
  Absent: 'danger',
  Present: 'success',
  Overtime: 'primary',
  Deficient: 'warning',
  'Single Punch': 'danger',
};

const now = new Date();
const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

function EmployeeList({ onView }) {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['employees', { type: 'Own', forTimesheets: true }],
    queryFn: () => listEmployees({ type: 'Own', limit: 100, sortBy: 'fullName', sortOrder: 'asc' }),
  });
  const employees = data?.items ?? [];

  const columns = [
    {
      key: 'name',
      header: t('staffTimesheets.employeeList.columns.name'),
      render: (e) => (
        <span className="font-medium text-text">
          {e.fullName} <span className="font-normal text-muted">({e.employeeId})</span>
        </span>
      ),
    },
    {
      key: 'view',
      header: '',
      className: 'text-right',
      render: (e) => (
        <Button size="sm" variant="ghost" onClick={() => onView(e)}>
          {t('staffTimesheets.employeeList.viewButton')}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <p className="mb-4 text-xs text-muted">{t('staffTimesheets.employeeList.description')}</p>
      {isError ? (
        <EmptyState
          title={t('staffTimesheets.employeeList.couldNotLoad')}
          description={apiMessage(error) || t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={employees}
          rowKey={(e) => e._id}
          loading={isPending}
          onRowClick={onView}
          emptyState={
            <EmptyState
              title={t('staffTimesheets.employeeList.emptyTitle')}
              description={t('staffTimesheets.employeeList.emptyDescription')}
            />
          }
        />
      )}
    </Card>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-text">{value}</p>
    </div>
  );
}

function MonthlyTimesheetDetail({ employee, onBack }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: report, isPending, isError, error, refetch } = useQuery({
    queryKey: ['timesheets', 'monthly-report', employee._id, month, year],
    queryFn: () => getMonthlyReport({ employeeId: employee._id, month: Number(month), year: Number(year) }),
  });

  const exportMutation = useMutation({
    mutationFn: () => {
      const filename = `timesheet-report_${employee.employeeId}_${year}-${String(month).padStart(2, '0')}.xlsx`;
      return generateMonthlyReport({ employeeId: employee._id, month: Number(month), year: Number(year) }, filename);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    { key: 'date', header: t('staffTimesheets.detail.columns.date'), render: (r) => r.date },
    { key: 'day', header: t('staffTimesheets.detail.columns.day'), render: (r) => r.day },
    { key: 'login', header: t('staffTimesheets.detail.columns.login'), className: 'tabular-nums', render: (r) => r.login ?? '—' },
    { key: 'logout', header: t('staffTimesheets.detail.columns.logout'), className: 'tabular-nums', render: (r) => r.logout ?? '—' },
    { key: 'worked', header: t('staffTimesheets.detail.columns.worked'), className: 'tabular-nums', render: (r) => minutesToHHMM(r.workedMinutes) },
    { key: 'required', header: t('staffTimesheets.detail.columns.required'), className: 'tabular-nums', hideOnMobile: true, render: (r) => minutesToHHMM(r.requiredMinutes) },
    { key: 'deficiency', header: t('staffTimesheets.detail.columns.deficiency'), className: 'tabular-nums', hideOnMobile: true, render: (r) => minutesToHHMM(r.deficiencyMinutes) },
    { key: 'overtime', header: t('staffTimesheets.detail.columns.overtime'), className: 'tabular-nums', hideOnMobile: true, render: (r) => minutesToHHMM(r.overtimeMinutes) },
    {
      key: 'status',
      header: t('staffTimesheets.detail.columns.status'),
      render: (r) => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'default'} title={r.status === 'Single Punch' ? t('staffTimesheets.detail.singlePunchNote') : undefined}>
          {t(`staffTimesheets.detail.status.${r.status}`, r.status)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs font-medium text-primary hover:underline">
        ← {t('staffTimesheets.detail.backToList')}
      </button>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {employee.fullName} <span className="font-normal text-muted">({employee.employeeId})</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select label={t('staffTimesheets.detail.month')} value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {t(`common.months.${m}`)}
                </option>
              ))}
            </Select>
            <Select label={t('staffTimesheets.detail.year')} value={year} onChange={(e) => setYear(e.target.value)}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              {t('staffTimesheets.detail.exportExcel')}
            </Button>
          </div>
        </div>

        {isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <EmptyState
            title={t('staffTimesheets.detail.couldNotLoad')}
            description={apiMessage(error) || t('common.checkConnection')}
            action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <SummaryStat label={t('staffTimesheets.detail.summary.presentDays')} value={report.summary.presentDays} />
              <SummaryStat label={t('staffTimesheets.detail.summary.absentDays')} value={report.summary.absentDays} />
              <SummaryStat label={t('staffTimesheets.detail.summary.singlePunchDays')} value={report.summary.singlePunchDays} />
              <SummaryStat label={t('staffTimesheets.detail.summary.offDays')} value={report.summary.offDays} />
              <SummaryStat label={t('staffTimesheets.detail.summary.totalWorked')} value={minutesToHHMM(report.summary.totalWorkedMinutes)} />
              <SummaryStat label={t('staffTimesheets.detail.summary.totalOvertime')} value={minutesToHHMM(report.summary.totalOvertimeMinutes)} />
            </div>
            <Table columns={columns} rows={report.rows} rowKey={(r) => r.date} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function TimesheetsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [viewingEmployee, setViewingEmployee] = useState(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t('staffTimesheets.page.title')}
        description={t('staffTimesheets.page.description')}
        onBack={() => (viewingEmployee ? setViewingEmployee(null) : navigate(-1))}
      />
      {viewingEmployee ? (
        <MonthlyTimesheetDetail employee={viewingEmployee} onBack={() => setViewingEmployee(null)} />
      ) : (
        <EmployeeList onView={setViewingEmployee} />
      )}
    </div>
  );
}
