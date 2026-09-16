/**
 * Client-side deployment form schemas — monthly hours entry/correction and
 * Demobilise. No create/edit schema here on purpose — see deployments.api.js.
 */
import { z } from 'zod';
import { DEMOBILISATION_OUTCOME } from '../../lib/constants.js';

const optionalStr = (max) => z.string().trim().max(max).optional().or(z.literal(''));

/** Mirrors deployment.service.js's own outcome resolution exactly — used
 *  client-side only for UI branching (the inline warning, and whether to
 *  show the post-demobilise EOSB prompt), never trusted as authoritative:
 *  the server independently recomputes and enforces the same rule. */
export function resolveDemobiliseOutcome(workerType, reason, exitOutcome) {
  if (workerType !== 'Employee') return 'Standby';
  if (reason === 'Other') return exitOutcome ? 'Exit' : 'Standby';
  return DEMOBILISATION_OUTCOME[reason] ?? 'Standby';
}

/** Real day count for a 'YYYY-MM' string (28-31) — mirrors the server's own
 *  daysInMonth (deployment.service.js) exactly, so the grid always renders
 *  the right number of day inputs for the selected month. */
export function daysInMonth(monthStr) {
  if (!monthStr) return 0;
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Reverted 2026-09-16 (the user's own ask) from a day-by-day grid (added
// 2026-09-12, see docs/DEPLOYMENT-notes.md's own follow-up on that) back to
// two typed totals transcribed straight off the client's own timesheet —
// the shape this app originally used before the daily grid existed (see
// docs/MOBILISATION-notes.md's 2026-09-12 follow-up). `otHours` is still
// always server-computed (`max(0, actualHours - contractHours)`, unchanged
// formula — see deployment.service.js), never sent from here.
export const monthlyHoursFormSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.'),
  actualHours: z.string().min(1, 'Enter the client timesheet hours.'),
  daysWorked: z.string().min(1, 'Enter the number of days worked.'),
  deductionAmount: z.string().optional().or(z.literal('')),
  notes: optionalStr(500),
});

export const emptyMonthlyHoursForm = {
  month: '',
  actualHours: '',
  daysWorked: '',
  deductionAmount: '',
  notes: '',
};

const DAILY_STATUS_LETTER = { Off: 'F', Sick: 'S', Absent: 'A' };

/** A saved {status, hours} day → the single display string — read-only use
 *  only now (DeploymentDetailPage's collapsible breakdown for a pre-
 *  2026-09-16 entry that still has real dailyHours; see deployment.model.js's
 *  own doc comment on why that array is never written to again). */
export function dailyEntryToString(day) {
  const letter = DAILY_STATUS_LETTER[day.status];
  return letter ?? String(day.hours ?? '');
}

export function monthlyHoursEntryToForm(entry) {
  return {
    month: entry.month,
    actualHours: String(entry.actualHours ?? ''),
    daysWorked: String(entry.daysWorked ?? ''),
    deductionAmount: entry.deductionAmount ? String(entry.deductionAmount) : '',
    notes: entry.notes ?? '',
  };
}

// `exitOutcome` only matters when reason === 'Other' — every other reason
// has a fixed outcome (see deployment.model.js's DEMOBILISATION_OUTCOME,
// mirrored in lib/constants.js). Kept as a plain boolean, not coerced from a
// checkbox string, since DemobiliseForm controls it directly via setValue.
export const demobiliseFormSchema = z.object({
  releaseDate: z.string().min(1, 'Demobilisation date is required.'),
  reason: z.string().min(1, 'Choose a reason.'),
  exitOutcome: z.boolean().optional(),
  releaseNote: optionalStr(1000),
});

export const emptyDemobiliseForm = {
  releaseDate: new Date().toISOString().slice(0, 10),
  reason: '',
  exitOutcome: false,
  releaseNote: '',
};
