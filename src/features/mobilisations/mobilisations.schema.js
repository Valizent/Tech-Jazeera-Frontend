/**
 * Client-side mobilisation form schema (M1: Section 1 fields, Draft only) —
 * instant feedback; the server's Zod layer is the real gatekeeper (same
 * split as everywhere else in this app). Numeric fields stay strings here,
 * same convention as expenses.schema.js's `amount` — the server coerces.
 */
import { z } from 'zod';

const optionalStr = (max) => z.string().trim().max(max).optional().or(z.literal(''));

// Bounds mirror mobilisation.validation.js's own optionalNonNegNumber/
// optionalNonNegMoney/requiredNonNegNumber exactly (2026-09-29, a real audit
// finding: these rate/commission/FTA/allowance fields had no bound at all
// client-side, so a negative or absurdly large value passed here and only
// ever got caught by a raw server-error toast). Rates/commissions/FTA/
// allowance are per-hour or per-unit figures — a much smaller ceiling than
// a money-total field is the honest bound; mobilisationCost is a one-time
// lump sum, same higher ceiling deployment.schema.js's own deductionAmount
// uses.
const optionalRateNumberString = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || !Number.isNaN(Number(v)), 'Enter a valid number.')
  .refine((v) => !v || Number(v) >= 0, 'Cannot be negative.')
  .refine((v) => !v || Number(v) <= 100_000, 'That looks too high check the figure.');
const optionalMoneyNumberString = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || !Number.isNaN(Number(v)), 'Enter a valid number.')
  .refine((v) => !v || Number(v) >= 0, 'Cannot be negative.')
  .refine((v) => !v || Number(v) <= 1_000_000, 'That looks too high check the figure.');
const requiredRateNumberString = (message) =>
  z
    .string()
    .min(1, message)
    .refine((v) => !Number.isNaN(Number(v)), message)
    .refine((v) => Number(v) >= 0, 'Cannot be negative.')
    .refine((v) => Number(v) <= 100_000, 'That looks too high check the figure.');

// Saudi Iqama numbers are exactly 10 digits. Mirrors the server's own regex
// in mobilisation.validation.js — only meaningful for a SupplierEmployee/
// Freelancer mobilisation (typed directly; an Employee's comes from their
// linked record instead).
const optionalIqama = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || /^\d{10}$/.test(value), {
    message: 'Iqama number must be exactly 10 digits.',
  });

// Saudi mobile only (this company operates in Saudi Arabia) — local
// 05XXXXXXXX (10 digits) or international +9665XXXXXXXX/9665XXXXXXXX (966 +
// 9 digits starting with 5). Mirrors the server's own regex in
// mobilisation.validation.js — scoped to Mobilisation's phone field only.
export const SAUDI_PHONE_REGEX = /^(?:\+?9665\d{8}|05\d{8})$/;
// '+966' alone is the form's own pre-filled placeholder (see
// emptyMobilisationForm below), not a value the coordinator actually typed
// — treat it the same as empty, or every Own Employee mobilisation (whose
// phone field isn't even rendered — the real number lives on their
// Employee record) fails validation on a placeholder that was never
// really "filled in". Bug found 2026-09-12: this silently blocked every
// Own Employee Draft save with no visible error, since the errored field
// wasn't in the DOM for that worker type — the toast/error UI had nothing
// to point at. The transform also means '+966' never reaches the server
// as if it were a real value.
const optionalSaudiPhone = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value === '+966' ? '' : value))
  .refine((value) => !value || SAUDI_PHONE_REGEX.test(value), {
    message: 'Enter a valid Saudi mobile number (e.g. 05XXXXXXXX or +9665XXXXXXXX).',
  });

export const WORKER_TYPES = ['Employee', 'SupplierEmployee', 'Freelancer'];

// Mirrors the server's own FTA_TYPES in mobilisation.model.js — what the
// `fta` amount actually covers. 'FTA' means Food+Travel+Accommodation
// combined; the other three are the individual components.
export const FTA_TYPES = ['FoodOnly', 'TravelOnly', 'AccommodationOnly', 'FTA'];

const recipientRow = z.object({ coordinatorId: z.string(), sharePercent: z.string() });

const mobilisationFields = {
  workerType: z.enum(WORKER_TYPES),
  // Employee: `worker` picks a real Employee record. SupplierEmployee/
  // Freelancer: no Employee record exists, so the identity fields below are
  // typed directly — required by the superRefine below, not here.
  worker: z.string().optional().or(z.literal('')),
  workerName: optionalStr(150),
  iqamaNumber: optionalIqama,
  nationality: optionalStr(80),
  phone: optionalSaudiPhone,
  jobTitle: z.string().trim().min(1, 'Job title is required.').max(150),
  // Both moved into Worker & Job (2026-09-13, the user's own ask) — set by
  // the coordinator/whoever creates this mobilisation up front, instead of
  // waiting on the current-step reviewer's later Section 2 pass (see
  // commercialDetailsFormSchema below, which no longer has them).
  requiredTimesheetHours: optionalRateNumberString,
  // otEmployeeRate = OT paid to the employee per hour (Own and subcontractor
  // employees). The OT client rate is no longer typed: the server bills OT at
  // the client rate (2026-10-12). A freelancer is paid by the hour instead,
  // at employeeRate, which is also their OT rate.
  otEmployeeRate: optionalRateNumberString,
  employeeRate: optionalRateNumberString,

  client: z.string().min(1, 'Select a client.'),
  site: optionalStr(150),
  // Required (2026-09-13, the user's own ask) — every mobilisation needs a
  // real client rate from the start.
  clientRate: requiredRateNumberString('Client rate is required.'),
  clientCommission: optionalRateNumberString,
  fta: optionalRateNumberString,
  ftaType: z.string().optional().or(z.literal('')),
  allowance: optionalRateNumberString,
  allowanceRemark: optionalStr(200),
  // One-time cost of mobilising this worker (2026-09-19, the user's own
  // ask) — mirrors mobilisation.model.js's own field.
  mobilisationCost: optionalMoneyNumberString,

  // Subcontractor block only applies to SupplierEmployee — see superRefine.
  subcontractor: z.string().optional().or(z.literal('')),
  subcontractorRate: optionalRateNumberString,
  subcontractorCommission: optionalRateNumberString,
  // No otSubcontractorRate/otSubcontractorCommission here (removed
  // 2026-09-14) — see otEmployeeRate above.

  // The client's / subcontractor's own coordinators involved in this
  // placement, and who each commission goes to (2026-10-12).
  clientCoordinatorIds: z.array(z.string()),
  subcontractorCoordinatorIds: z.array(z.string()),
  // The answer to "move him to this subcontractor?" - set by the form's own
  // prompt, never typed (2026-10-12).
  requestSubcontractorTransfer: z.boolean().optional(),
  // Who each commission goes to (2026-10-13): one to three coordinators, each
  // with a percentage share. `...Multiple` is whether the form's "Multiple
  // coordinators" box is open; it is never sent.
  clientCommissionRecipients: z.array(recipientRow),
  subcontractorCommissionRecipients: z.array(recipientRow),
  clientCommissionMultiple: z.boolean(),
  subcontractorCommissionMultiple: z.boolean(),

  mobilisationDate: z.string().min(1, 'Mobilisation date is required.'),
  checkoutDate: z.string().optional().or(z.literal('')),

  remark: optionalStr(1000),

  // Only ever shown/used when an Office Secretary creates this "for" a
  // Coordinator who's busy — see MobilisationForm's coordinatorCandidates
  // prop. Left plain-optional here (the server is the real "required for
  // Office Secretary" gate) since this same schema is shared with every
  // other creator, for whom the field is simply never rendered.
  onBehalfOf: z.string().optional().or(z.literal('')),

  // Create-only, like onBehalfOf: the Requirements card + candidate this
  // mobilisation was started from ("Start mobilisation" on a candidate). Never
  // shown or typed — MobilisationNewPage fills them in from the URL, and the
  // server verifies them. Blank for every mobilisation that didn't start there.
  requirement: z.string().optional().or(z.literal('')),
  requirementCandidate: z.string().optional().or(z.literal('')),
};

/** One side's commission recipients: a single coordinator, or two to three with shares totalling 100. */
function checkRecipients(data, side, ctx) {
  const path = [`${side}CommissionRecipients`];
  const picked = data[`${side}CommissionRecipients`].filter((r) => r.coordinatorId);
  const add = (message) => ctx.addIssue({ code: 'custom', path, message });
  if (picked.length === 0) {
    add(`Choose which ${side} coordinator the ${side} commission goes to.`);
  } else if (data[`${side}CommissionMultiple`]) {
    if (picked.length < 2) {
      add('Pick at least two coordinators, or choose a single coordinator instead.');
    } else if (new Set(picked.map((r) => r.coordinatorId)).size !== picked.length) {
      add('Pick each coordinator only once.');
    } else if (picked.some((r) => !(Number(r.sharePercent) > 0))) {
      add('Give every coordinator a share above 0%.');
    } else {
      const total = picked.reduce((sum, r) => sum + Number(r.sharePercent), 0);
      if (Math.abs(total - 100) > 0.01) add(`The shares must add up to 100% (they add up to ${Math.round(total * 100) / 100}%).`);
    }
  }
}

/** The form's commission pickers as the API takes them: only real picks, and
 *  nothing at all when that side's commission is under 1. */
export function withCommissionRecipients(values) {
  const rest = { ...values };
  delete rest.clientCommissionMultiple;
  delete rest.subcontractorCommissionMultiple;
  const clean = (rows, needed) =>
    needed
      ? rows
          .filter((r) => r.coordinatorId)
          .map((r) => ({ coordinatorId: r.coordinatorId, ...(r.sharePercent !== '' && { sharePercent: Number(r.sharePercent) }) }))
      : [];
  return {
    ...rest,
    clientCommissionRecipients: clean(values.clientCommissionRecipients, Number(values.clientCommission) >= 1),
    subcontractorCommissionRecipients: clean(
      values.subcontractorCommissionRecipients,
      values.workerType === 'SupplierEmployee' && Number(values.subcontractorCommission) >= 1
    ),
  };
}

export const mobilisationFormSchema = z.object(mobilisationFields).superRefine((data, ctx) => {
  if (data.workerType === 'Employee' && !data.worker) {
    ctx.addIssue({ code: 'custom', path: ['worker'], message: 'Select an employee.' });
  }
  if (data.workerType !== 'Employee' && !data.workerName) {
    ctx.addIssue({ code: 'custom', path: ['workerName'], message: 'Employee name is required.' });
  }
  if (data.workerType === 'SupplierEmployee' && !data.subcontractor) {
    ctx.addIssue({ code: 'custom', path: ['subcontractor'], message: 'Select a subcontractor.' });
  }
  // A freelancer is paid by the hour (2026-10-12); their OT follows it.
  if (data.workerType === 'Freelancer' && !(Number(data.employeeRate) > 0)) {
    ctx.addIssue({ code: 'custom', path: ['employeeRate'], message: 'Employee rate per hour is required for a freelancer.' });
  }
  // A commission of 1 or more has to go to someone at that company.
  if (Number(data.clientCommission) >= 1) checkRecipients(data, 'client', ctx);
  if (data.workerType === 'SupplierEmployee' && Number(data.subcontractorCommission) >= 1) {
    checkRecipients(data, 'subcontractor', ctx);
  }
  // Mirrors the server's own withFtaTypeRefine — the amount input is also
  // disabled in the form until a type is picked, so this mostly guards
  // against a stale value left over from unchecking the type. `fta` stays a
  // STRING here (see this file's own header comment — numeric fields aren't
  // coerced client-side), so a real bug: `data.fta && ...` treated the
  // string "0" as truthy, wrongly demanding a type on every record whose FTA
  // amount is exactly zero (the model's own default). `Number(data.fta) > 0`
  // is the actual "was a real amount entered" check.
  if (Number(data.fta) > 0 && !data.ftaType) {
    ctx.addIssue({ code: 'custom', path: ['ftaType'], message: 'Select what this FTA amount is for.' });
  }
});

export const emptyMobilisationForm = {
  workerType: 'Employee',
  worker: '',
  workerName: '',
  iqamaNumber: '',
  nationality: '',
  phone: '+966',
  jobTitle: '',
  requiredTimesheetHours: '',
  otEmployeeRate: '',
  employeeRate: '',
  client: '',
  site: '',
  clientRate: '',
  clientCommission: '',
  fta: '',
  ftaType: '',
  allowance: '',
  allowanceRemark: '',
  mobilisationCost: '',
  subcontractor: '',
  subcontractorRate: '',
  subcontractorCommission: '',
  clientCoordinatorIds: [],
  subcontractorCoordinatorIds: [],
  clientCommissionRecipients: [],
  subcontractorCommissionRecipients: [],
  clientCommissionMultiple: false,
  subcontractorCommissionMultiple: false,
  mobilisationDate: new Date().toISOString().slice(0, 10),
  checkoutDate: '',
  remark: '',
  onBehalfOf: '',
  requirement: '',
  requirementCandidate: '',
};

// --- M3: current-step reviewer's Section 2 (Office Secretary, then
// Marketing Manager, once configured) — the client/sub quotation-PO paper
// trail, remark. Every field optional: a reviewer fills in what they have
// as it arrives. No actual-hours field here at all (removed 2026-09-12) —
// a real worker isn't placed yet at this stage, so there's no timesheet to
// enter; that now lives entirely on the Deployment this mobilisation
// produces once Approved (see features/deployments/deployments.schema.js's
// day-by-day grid, filled in month by month as the client's real
// timesheets arrive). No OT rate fields here either as of 2026-09-13 — the
// user's own ask moved that responsibility to Section 1 (mobilisationFields
// above), filled by the coordinator up front instead of the reviewer. ---

export const commercialDetailsFormSchema = z.object({
  clientQuotation: optionalStr(100),
  clientQuotationDate: z.string().optional().or(z.literal('')),
  clientPO: optionalStr(100),
  clientPODate: z.string().optional().or(z.literal('')),
  subQuotation: optionalStr(100),
  subQuotationDate: z.string().optional().or(z.literal('')),
  subPO: optionalStr(100),
  subPODate: z.string().optional().or(z.literal('')),
  remark: optionalStr(1000),
});

export function commercialDetailsToForm(m) {
  return {
    clientQuotation: m.clientQuotation ?? '',
    clientQuotationDate: m.clientQuotationDate ? m.clientQuotationDate.slice(0, 10) : '',
    clientPO: m.clientPO ?? '',
    clientPODate: m.clientPODate ? m.clientPODate.slice(0, 10) : '',
    subQuotation: m.subQuotation ?? '',
    subQuotationDate: m.subQuotationDate ? m.subQuotationDate.slice(0, 10) : '',
    subPO: m.subPO ?? '',
    subPODate: m.subPODate ? m.subPODate.slice(0, 10) : '',
    remark: m.remark ?? '',
  };
}

/** Rejecting requires a note (what to fix) and a rejectionTarget (who it
 *  goes back to — Coordinator/OfficeSecretary/Both, mirrors the server's
 *  decideMobilisationSchema exactly). */
export const decideMobilisationFormSchema = z
  .object({
    status: z.enum(['Approved', 'Rejected']),
    decisionNote: optionalStr(500),
    rejectionTarget: z.enum(['Coordinator', 'OfficeSecretary', 'Both']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'Rejected' && !data.decisionNote) {
      ctx.addIssue({ code: 'custom', path: ['decisionNote'], message: 'Explain what needs fixing before rejecting.' });
    }
    if (data.status === 'Rejected' && !data.rejectionTarget) {
      ctx.addIssue({ code: 'custom', path: ['rejectionTarget'], message: 'Choose who this should go back to.' });
    }
  });

/** A saved side's recipients for the form: the list, or - on a record saved
 *  before shares existed - its single recipient at 100%. */
function recipientsToForm(m, side) {
  const list = m[`${side}CommissionRecipients`];
  if (list?.length) return list.map((r) => ({ coordinatorId: r.coordinatorId, sharePercent: String(r.sharePercent) }));
  const single = m[`${side}CommissionCoordinator`];
  return single ? [{ coordinatorId: single.coordinatorId, sharePercent: '100' }] : [];
}

export function mobilisationToForm(m) {
  return {
    workerType: m.workerType ?? 'Employee',
    worker: m.worker ?? '',
    workerName: m.workerName ?? '',
    iqamaNumber: m.iqamaNumber ?? '',
    nationality: m.nationality ?? '',
    phone: m.phone || '+966',
    jobTitle: m.jobTitle,
    requiredTimesheetHours: String(m.requiredTimesheetHours ?? ''),
    otEmployeeRate: String(m.otEmployeeRate ?? ''),
    employeeRate: m.employeeRate ? String(m.employeeRate) : '',
    client: m.client,
    site: m.site ?? '',
    clientRate: String(m.clientRate ?? ''),
    clientCommission: String(m.clientCommission ?? ''),
    fta: String(m.fta ?? ''),
    ftaType: m.ftaType ?? '',
    allowance: String(m.allowance ?? ''),
    allowanceRemark: m.allowanceRemark ?? '',
    mobilisationCost: String(m.mobilisationCost ?? ''),
    subcontractor: m.subcontractor ?? '',
    subcontractorRate: String(m.subcontractorRate ?? ''),
    subcontractorCommission: String(m.subcontractorCommission ?? ''),
    clientCoordinatorIds: (m.clientCoordinators ?? []).map((c) => c.coordinatorId),
    subcontractorCoordinatorIds: (m.subcontractorCoordinators ?? []).map((c) => c.coordinatorId),
    clientCommissionRecipients: recipientsToForm(m, 'client'),
    subcontractorCommissionRecipients: recipientsToForm(m, 'subcontractor'),
    clientCommissionMultiple: recipientsToForm(m, 'client').length > 1,
    subcontractorCommissionMultiple: recipientsToForm(m, 'subcontractor').length > 1,
    mobilisationDate: m.mobilisationDate ? m.mobilisationDate.slice(0, 10) : '',
    checkoutDate: m.checkoutDate ? m.checkoutDate.slice(0, 10) : '',
    remark: m.remark ?? '',
  };
}
