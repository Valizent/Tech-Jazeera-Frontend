/**
 * TimesheetProcessorPage — the monthly timesheet tool, gated by the real
 * 'timesheetProcessor' Section Access grant (fixed 2026-09-14, a real
 * QA-audit-found gap — this used to hardcode Admin-only client-side even
 * after the server moved to Section Access). Write-gated as a whole (no
 * separate read-only view makes sense — per the section's own description,
 * it's a stateless tool with nothing to view besides running it).
 *
 * Flow: pick an employee + month/year (+ optional required-hours override),
 * upload that employee's attendance .xlsx, Process to preview the computed
 * timesheet, then Export the formatted workbook. The server is authoritative for
 * all the maths; this screen only collects inputs and renders results.
 *
 * The exact inputs of a successful preview are captured in `lastRun` so Export
 * regenerates from identical data even if the form is edited afterwards.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useEmployeePicker } from '../../../lib/useEmployeePicker.js';
import { previewTimesheet, exportTimesheet } from '../timesheet.api.js';
import {
  MONTHS,
  DEFAULT_REQUIRED_HHMM,
  TIMESHEET_ACCEPT,
  hhmmToMinutes,
} from '../timesheet.constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import TimesheetResults from '../components/TimesheetResults.jsx';
import HolidayCalendar from '../components/HolidayCalendar.jsx';

const MAX_MB = 5;
const now = new Date();
const YEARS = Array.from({ length: 7 }, (_, i) => now.getFullYear() + 1 - i); // next year … 5 back

/** Assemble the multipart payload shared by preview and export. */
function buildFormData({ file, employeeId, month, year, requiredMinutes, holidays }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('employeeId', employeeId);
  fd.append('month', String(month));
  fd.append('year', String(year));
  if (requiredMinutes != null) fd.append('requiredMinutes', String(requiredMinutes));
  if (holidays && holidays.length) fd.append('holidays', holidays.join(','));
  return fd;
}

export default function TimesheetProcessorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = Boolean(user.sectionAccessWrite?.includes('timesheetProcessor'));

  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [requiredHHMM, setRequiredHHMM] = useState(DEFAULT_REQUIRED_HHMM);
  const [holidays, setHolidays] = useState(() => new Set());
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState(null);
  const [result, setResult] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Fixed 2026-09-15, a real QA-audit-found gap — A3: `timesheetProcessor`
  // write access does not imply `employeeCreate` read access (two separate
  // Section Access grants) — a Manager holding only the former saw this
  // whole page render, but the employee dropdown silently came back empty,
  // with no indication that the lookup itself had actually 403'd rather
  // than the company simply having no employees. `isError` is now surfaced
  // right under the picker (see the Select below) instead of swallowed.
  const { data: employeeData, isError: employeeLookupFailed } = useEmployeePicker({ enabled: canWrite });

  const previewMutation = useMutation({
    mutationFn: (run) => previewTimesheet(buildFormData(run)),
    onSuccess: (data, run) => {
      setResult(data);
      setLastRun(run);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (!canWrite) return <Navigate to="/" replace />;

  const employees = employeeData?.items ?? [];

  function handleProcess(e) {
    e.preventDefault();
    setFormError(null);
    if (!employeeId) return setFormError('Select an employee.');
    if (!file) return setFormError('Choose the attendance Excel file.');
    if (file.size > MAX_MB * 1024 * 1024) return setFormError(`File is too large (maximum ${MAX_MB} MB).`);
    const requiredMinutes = hhmmToMinutes(requiredHHMM);
    if (requiredMinutes == null) return setFormError('Required hours must look like HH:MM (e.g. 08:00).');
    previewMutation.mutate({
      file,
      employeeId,
      month: Number(month),
      year: Number(year),
      requiredMinutes,
      holidays: Array.from(holidays),
    });
  }

  async function handleExport() {
    if (!lastRun) return;
    setExporting(true);
    try {
      const filename = `timesheet_${result.employee.employeeId}_${result.year}-${String(result.month).padStart(2, '0')}.xlsx`;
      await exportTimesheet(buildFormData(lastRun), filename);
    } catch (error) {
      toast.error(apiMessage(error, 'Could not export the file.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Timesheet Processor"
        description="Upload an employee's monthly door-access log to generate a salary-ready timesheet."
        onBack={() => navigate(-1)}
      />

      <Card>
        <form onSubmit={handleProcess} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Select
                label="Employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </Select>
              {employeeLookupFailed && (
                <p className="mt-1.5 text-xs text-danger">
                  Couldn&apos;t load the employee list — you may be missing read access to &quot;Employees&quot;. Ask an
                  admin to grant it under Section Access.
                </p>
              )}
            </div>
            <Select
              label="Month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setHolidays(new Set()); // day numbers don't carry across months
              }}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              label="Year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setHolidays(new Set());
              }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Required hours / day"
              value={requiredHHMM}
              onChange={(e) => setRequiredHHMM(e.target.value)}
              placeholder="08:00"
            />
            <div className="flex flex-col gap-1.5 lg:col-span-3">
              <label className="text-sm font-medium text-text">Attendance file (.xls / .xlsx)</label>
              <input
                type="file"
                accept={TIMESHEET_ACCEPT}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFormError(null);
                }}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
              />
              <p className="text-xs text-muted">Door-access punch log · .xls or .xlsx up to {MAX_MB} MB</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <HolidayCalendar
              year={Number(year)}
              month={Number(month)}
              value={holidays}
              onChange={setHolidays}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" isLoading={previewMutation.isPending}>
                Process
              </Button>
              {previewMutation.isPending && (
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Spinner className="h-4 w-4 text-primary" /> Reading punches…
                </span>
              )}
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Card>

      {result && (
        <div className="mt-6">
          <TimesheetResults result={result} onExport={handleExport} exporting={exporting} />
        </div>
      )}
    </div>
  );
}
