/**
 * Timesheets API layer — the Monthly Report list/view/export flow (rebuilt
 * 2026-09-13; the old weekly submit/review-queue endpoints this file used to
 * wrap have no client anymore — see docs/TIMESHEETS-MONTHLY-REPORT-notes.md
 * for why the underlying server routes/model were deliberately left in
 * place regardless, and what that means for Payroll's overtime figure going
 * forward). A worker's own submit/list calls live in features/ess/ess.api.js
 * (/api/me/timesheets), untouched by this — a completely separate flow.
 */
import { api } from '../../lib/axios.js';

/**
 * The JSON preview behind the on-screen monthly grid — same eligibility
 * floor and same underlying data as the .xlsx export below, just not
 * converted to a file yet.
 */
export async function getMonthlyReport({ employeeId, month, year }) {
  const { data } = await api.get('/timesheets/monthly-report', { params: { employeeId, month, year } });
  return data.data;
}

/**
 * A full day-by-day monthly report built from real attendance, in the same
 * formatted style as the Timesheet Processor's export. Only Admin or a real
 * Approval Role member can generate it — the server is the real gate; a
 * non-member gets a clear 403, same as the Approval Log. Downloads an
 * authenticated Blob, same pattern as every other export.
 */
export async function generateMonthlyReport({ employeeId, month, year }, filename) {
  const res = await api.post(
    '/timesheets/monthly-report',
    { employeeId, month, year },
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
