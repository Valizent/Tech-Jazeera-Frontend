/**
 * Client-side leave schemas — instant feedback; the server's Zod layer is the
 * real gatekeeper (same split as everywhere else in this app).
 */
import { z } from 'zod';
import { LEAVE_RECURRENCES, DEFAULT_SICK_PAY_TIERS } from '../../lib/constants.js';

const optionalNum = z
  .string()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? undefined : v));

// Bound mirrors leaveType.model.js/leave.validation.js's own payPercent
// exactly (2026-09-29, a real audit finding: this used to only check
// non-empty, so a value like 500 passed here — the `max="100"` on the
// <input> is trivially bypassed since this form has `noValidate` — and only
// ever got caught by a raw server-error toast).
const sickPayTierFormSchema = z.object({
  days: z.string().min(1, 'Required.'),
  payPercent: z
    .string()
    .min(1, 'Required.')
    .refine((v) => !Number.isNaN(Number(v)), 'Required.')
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Must be between 0 and 100.'),
});

export const leaveTypeFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required.').max(60),
    recurrence: z.enum(LEAVE_RECURRENCES),
    daysPerYear: optionalNum,
    tierYears: optionalNum,
    tierDaysPerYear: optionalNum,
    cycleYears: optionalNum,
    daysPerCycle: optionalNum,
    sickPayTiers: z.array(sickPayTierFormSchema),
    minServiceMonths: z.string().min(1, 'Enter 0 if there is no minimum.'),
    maxDaysPerRequest: optionalNum,
    isPaid: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence === 'Annual' && !data.daysPerYear) {
      ctx.addIssue({ code: 'custom', path: ['daysPerYear'], message: 'Required for Annual leave.' });
    }
    if (data.recurrence === 'ContractCycle' && (!data.cycleYears || !data.daysPerCycle)) {
      ctx.addIssue({ code: 'custom', path: ['cycleYears'], message: 'Cycle length and days/cycle are required.' });
    }
    if (data.recurrence === 'Sick' && data.sickPayTiers.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['sickPayTiers'], message: 'At least one pay tier is required.' });
    }
    // Mirrors the server's cross-field check: a tier with no day count (or a
    // day count with no tier) is meaningless. Missing this on the client was
    // the actual bug — the form let an incomplete tier through to a 400 with
    // no visible reason why.
    if (Boolean(data.tierYears) !== Boolean(data.tierDaysPerYear)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tierYears'],
        message: 'Tier years and tier days must be set together.',
      });
      ctx.addIssue({
        code: 'custom',
        path: ['tierDaysPerYear'],
        message: 'Tier years and tier days must be set together.',
      });
    }
  });

export const emptyLeaveTypeForm = {
  name: '',
  recurrence: 'Annual',
  daysPerYear: '',
  tierYears: '',
  tierDaysPerYear: '',
  cycleYears: '',
  daysPerCycle: '',
  sickPayTiers: [],
  minServiceMonths: '0',
  maxDaysPerRequest: '',
  isPaid: true,
  isActive: true,
};

/** Pre-filled with Article 117's statutory tiers — the sensible starting
 *  point when someone picks 'Sick' for a brand-new leave type, editable
 *  before saving. Only used for a NEW type; editing an existing one always
 *  shows its own real stored tiers via leaveTypeToForm(). */
export const emptySickLeaveTypeForm = { ...emptyLeaveTypeForm, recurrence: 'Sick', sickPayTiers: DEFAULT_SICK_PAY_TIERS };

export function leaveTypeToForm(type) {
  return {
    name: type.name,
    recurrence: type.recurrence,
    daysPerYear: type.daysPerYear != null ? String(type.daysPerYear) : '',
    tierYears: type.tierYears != null ? String(type.tierYears) : '',
    tierDaysPerYear: type.tierDaysPerYear != null ? String(type.tierDaysPerYear) : '',
    cycleYears: type.cycleYears != null ? String(type.cycleYears) : '',
    daysPerCycle: type.daysPerCycle != null ? String(type.daysPerCycle) : '',
    sickPayTiers: (type.sickPayTiers ?? []).map((t) => ({ days: String(t.days), payPercent: String(t.payPercent) })),
    minServiceMonths: String(type.minServiceMonths ?? 0),
    maxDaysPerRequest: type.maxDaysPerRequest != null ? String(type.maxDaysPerRequest) : '',
    isPaid: type.isPaid ?? true,
    isActive: type.isActive,
  };
}

export const submitLeaveFormSchema = z
  .object({
    leaveType: z.string().min(1, 'Choose a leave type.'),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  // Fixed 2026-09-29 (a real audit finding): there was no cross-field check
  // at all — an end date before the start date passed client validation and
  // only ever failed server-side, with no warning shown before submitting.
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date.',
  });

export const emptySubmitLeaveForm = { leaveType: '', startDate: '', endDate: '', reason: '' };
