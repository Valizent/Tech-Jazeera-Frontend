/**
 * Client-side deployment form schemas — monthly hours entry/correction,
 * Demobilise, and a narrow details Edit (2026-09-16, the user's own ask —
 * see deployments.api.js's updateDeployment).
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
// always server-computed, never sent from here — the formula itself now
// depends on worker type (2026-09-19, the user's own ask): SupplierEmployee
// is `max(0, actualHours - supplierHours)`, Employee/Freelancer stay
// `max(0, actualHours - contractHours)` — see deployment.service.js's
// computeOtHours.
//
// `supplierHours` is required only for a SupplierEmployee deployment — this
// schema is built per-form-instance (via `workerType`) rather than static,
// since only DeploymentDetailPage knows which deployment it's rendering for.
// Bounds mirror deployment.validation.js's own actualHours/supplierHours/
// deductionAmount exactly (2026-09-29, a real audit finding: this used to
// only check non-empty, so a negative or wildly-too-high value passed here
// and only ever got caught by a raw server-error toast instead of inline
// field feedback).
// The real "impossible hours" ceiling (18h/day × this deployment's actual
// placement days in the selected month) depends on the currently-typed
// month, which would mean rebuilding this schema/resolver on every keystroke
// — instead enforced as a live warning + submit guard in
// DeploymentDetailPage's own MonthlyHoursForm (mirroring
// deployment.service.js's real, authoritative assertPossibleHours check).
// This flat 1000 stays as a basic sanity bound underneath that.
const hoursField = (message) =>
  z
    .string()
    .min(1, message)
    .refine((v) => !Number.isNaN(Number(v)), message)
    .refine((v) => Number(v) >= 0, 'Cannot be negative.')
    .refine((v) => Number(v) <= 1000, 'That looks too high for one month — check the figure.');

// Optional counterpart of hoursField — same bounds when a value IS given,
// but never required (2026-10-01, the user's own ask: subcontractor hours
// are now a real, optional follow-up step, not a blocking requirement at
// creation — see deployment.service.js's addMonthlyHours doc comment).
const optionalHoursField = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || !Number.isNaN(Number(v)), 'Enter a number.')
  .refine((v) => !v || Number(v) >= 0, 'Cannot be negative.')
  .refine((v) => !v || Number(v) <= 1000, 'That looks too high for one month — check the figure.');

// Optional non-negative amount capped at 1,000,000 — shared by deductionAmount/
// supplierDeductionAmount/employeeAdditionalAmount below (2026-10-03, a real
// code-review finding: this exact chain was copy-pasted a 3rd time; same
// extraction reasoning as hoursField/optionalHoursField above).
const optionalMoneyField = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Cannot be negative.')
  .refine((v) => !v || Number(v) <= 1_000_000, 'That looks too high — check the figure.');

export function buildMonthlyHoursFormSchema() {
  return z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.'),
    actualHours: hoursField('Enter the client timesheet hours.'),
    supplierHours: optionalHoursField,
    deductionAmount: optionalMoneyField,
    // Supplier-side counterpart to deductionAmount above (2026-09-30) — only
    // ever shown/sent for a SupplierEmployee deployment, same bounds.
    supplierDeductionAmount: optionalMoneyField,
    supplierDeductionNote: optionalStr(500),
    employeeAdditionalAmount: optionalMoneyField,
    employeeAdditionalAmountNote: optionalStr(500),
    notes: optionalStr(500),
  });
}

export const emptyMonthlyHoursForm = {
  month: '',
  actualHours: '',
  supplierHours: '',
  deductionAmount: '',
  supplierDeductionAmount: '',
  supplierDeductionNote: '',
  employeeAdditionalAmount: '',
  employeeAdditionalAmountNote: '',
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
    supplierHours: entry.supplierHours != null ? String(entry.supplierHours) : '',
    deductionAmount: entry.deductionAmount ? String(entry.deductionAmount) : '',
    supplierDeductionAmount: entry.supplierDeductionAmount ? String(entry.supplierDeductionAmount) : '',
    supplierDeductionNote: entry.supplierDeductionNote ?? '',
    employeeAdditionalAmount: entry.employeeAdditionalAmount ? String(entry.employeeAdditionalAmount) : '',
    employeeAdditionalAmountNote: entry.employeeAdditionalAmountNote ?? '',
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

/** Mirrors the server's own updateDeploymentSchema exactly — see that
 *  file's doc comment for why this stops at these 4 fields. */
export const editDeploymentFormSchema = z.object({
  site: optionalStr(150),
  workerName: optionalStr(150),
  requiredTimesheetHours: z.string().optional().or(z.literal('')),
  notes: optionalStr(1000),
});

export function deploymentToEditForm(deployment) {
  return {
    site: deployment.site ?? '',
    workerName: deployment.workerName ?? '',
    requiredTimesheetHours: deployment.requiredTimesheetHours != null ? String(deployment.requiredTimesheetHours) : '',
    notes: deployment.notes ?? '',
  };
}
