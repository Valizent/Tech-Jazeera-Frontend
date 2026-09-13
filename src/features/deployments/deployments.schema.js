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
// Each day is EITHER a plain number 0-24 (hours worked) OR one of the
// single letters F/S/A (Off/Sick/Absent) — added the same day per the
// user's own ask: a non-working day is marked directly in the same cell,
// never a separate field, so it fully replaces the hours entry for that
// day rather than sitting alongside it (see parseDailyEntry below, and
// deployment.model.js's DAILY_ENTRY_STATUSES doc comment on the server
// side this maps onto). Kept as strings through the form the same way
// every other field here is, parsed only at submit time.
//
// A real NUMERIC range check, not a digit-count regex — found via a real
// user report (typed "25" into a day, which a naive `2[0-4]|1\d|\d` pattern
// would reject, but a laxer version could easily let slip, and a plain
// digit-count check would ALSO wrongly accept something like "24.9", which
// looks in-range by shape but isn't). `Number(trimmed)` on an already
// digit-shape-validated string is safe here — no NaN/Infinity path.
export function isValidDailyEntry(value) {
  const trimmed = value.trim();
  if (/^[fFsSaA]$/.test(trimmed)) return true;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  const hours = Number(trimmed);
  return hours >= 0 && hours <= 24;
}

export const monthlyHoursFormSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.'),
  dailyHours: z
    .array(z.string())
    .refine((arr) => arr.every((v) => isValidDailyEntry(v)), {
      message: "Enter each day's hours (0-24), or F/S/A for Off/Sick/Absent.",
    }),
  deductionAmount: z.string().optional().or(z.literal('')),
  notes: optionalStr(500),
});

export const emptyMonthlyHoursForm = {
  month: '',
  dailyHours: [],
  deductionAmount: '',
  notes: '',
};

const DAILY_STATUS_LETTER = { Off: 'F', Sick: 'S', Absent: 'A' };
const DAILY_LETTER_STATUS = { F: 'Off', S: 'Sick', A: 'Absent' };

/** One day's typed-in string → what the server expects — {status, hours}.
 *  A bare letter (case-insensitive) is Off/Sick/Absent with no hours;
 *  anything else is parsed as the day's worked hours. */
export function parseDailyEntry(value) {
  const letter = value.trim().toUpperCase();
  const status = DAILY_LETTER_STATUS[letter];
  if (status) return { status };
  return { status: 'Worked', hours: Number(value) };
}

/** The reverse of parseDailyEntry — a saved {status, hours} day → the
 *  single string the grid displays and re-edits. */
function dailyEntryToString(day) {
  const letter = DAILY_STATUS_LETTER[day.status];
  return letter ?? String(day.hours ?? '');
}

export function monthlyHoursEntryToForm(entry) {
  return {
    month: entry.month,
    dailyHours: entry.dailyHours?.length
      ? entry.dailyHours.map(dailyEntryToString)
      : Array(daysInMonth(entry.month)).fill(''),
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
