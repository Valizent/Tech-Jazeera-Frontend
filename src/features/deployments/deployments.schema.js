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

// One string per calendar day (day-by-day timesheet entry, not one
// aggregate number — see docs/DEPLOYMENT-notes.md's 2026-09-12 follow-up).
// Kept as strings through the form the same way every other numeric field
// here is, coerced to Number only at submit time.
export const monthlyHoursFormSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.'),
  dailyHours: z
    .array(z.string())
    .refine((arr) => arr.every((v) => v.trim() !== '' && Number(v) >= 0 && Number(v) <= 24), {
      message: 'Enter each day\'s hours (0-24).',
    }),
  otAmount: z.string().optional().or(z.literal('')),
  notes: optionalStr(500),
});

export const emptyMonthlyHoursForm = {
  month: '',
  dailyHours: [],
  otAmount: '',
  notes: '',
};

export function monthlyHoursEntryToForm(entry) {
  return {
    month: entry.month,
    dailyHours: entry.dailyHours?.length ? entry.dailyHours.map(String) : Array(daysInMonth(entry.month)).fill(''),
    otAmount: String(entry.otAmount ?? ''),
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
