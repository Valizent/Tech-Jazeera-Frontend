/**
 * Client-side employee form schema + form<->API mapping.
 *
 * Form values are ALL strings (that's what HTML inputs produce; date inputs
 * give "YYYY-MM-DD" or ""). We validate the string shapes here for instant
 * feedback and send them as-is — the server's Zod layer does the real
 * coercion and is the actual gatekeeper.
 */
import { z } from 'zod';
import { EMPLOYEE_STATUSES, EMPLOYEE_TYPES } from '../../lib/constants.js';
import { toDateInput } from '../../lib/utils.js';

const optional = z.string().trim().max(200).optional().or(z.literal(''));
const optionalHours = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine(
    (s) => !s || (!Number.isNaN(Number(s)) && Number(s) >= 0 && Number(s) <= 24),
    'Enter a number of hours between 0 and 24.'
  );
const optionalAmount = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((s) => !s || (!Number.isNaN(Number(s)) && Number(s) >= 0), 'Enter a valid amount.');
const optionalPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,18}$/, 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''));

/** number + expiry pair for one identity document. */
const documentSchema = z.object({ number: optional, expiry: z.string() });

export const employeeFormSchema = z
  .object({
    employeeId: z
      .string()
      .trim()
      .min(2, 'Employee ID is required.')
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, 'Only letters, numbers and dashes.'),
    fullName: z.string().trim().min(2, 'Full name is required.').max(100),
    // 'Own' = internal staff (reports to a Manager); 'Outsourced'/'Subcontracted'
    // = workforce. Both workforce types require the compliance fields
    // below; only 'Outsourced' additionally requires salary, and only
    // 'Subcontracted' requires `subcontractor` — see the superRefine below.
    type: z.enum(EMPLOYEE_TYPES),
    nationality: optional,
    mobile: optionalPhone,
    email: z.union([z.literal(''), z.email('Enter a valid email address.')]),

    passport: documentSchema,
    visa: documentSchema,
    iqama: documentSchema,
    medical: documentSchema,
    drivingLicense: documentSchema,

    joiningDate: z.string().optional().or(z.literal('')),
    designation: z.string().trim().min(2, 'Designation is required.').max(60),
    department: optional,
    salary: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((s) => !s || (!Number.isNaN(Number(s)) && Number(s) >= 0), 'Enter a valid amount.'),
    // Optional WPS breakdown of `salary` — leave blank unless the real split
    // for this employee is known (Payroll then treats the whole salary as Basic).
    basicSalary: optionalAmount,
    housingAllowance: optionalAmount,
    transportAllowance: optionalAmount,
    accommodation: optional,
    // Early-sign-out warning threshold for My Attendance — genuinely varies per
    // employee, so it's blank (no warning) unless Admin/Manager/HR sets it.
    expectedDailyHours: optionalHours,
    // A closed <select> of weekdays, not free text — no numeric range to
    // validate client-side, just "did they pick one of the options."
    weeklyOffDay: z.string().optional().or(z.literal('')),
    status: z.enum(EMPLOYEE_STATUSES),

    emergencyContact: z.object({ name: optional, phone: optionalPhone, relation: optional }),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
    // NOTE: `coordinator` is deliberately absent (Milestone 5) — fully
    // derived from Mobilisation state now, no longer a form field at all.
    // '' means "no manager assigned" — sent to the API as null. Universal
    // across both types (every 'Own' employee has one; an 'Outsourced'
    // employee may have one alongside or instead of a coordinator).
    manager: z.string().optional().or(z.literal('')),
    // Configurable Approval Hierarchy: overrides the company-wide default
    // ApprovalWorkflow for this employee. '' means "no override" — sent to
    // the API as null.
    approvalWorkflow: z.string().optional().or(z.literal('')),
    // '' means "not sourced from a subcontractor" — sent to the API as
    // null. Required only when type is 'Subcontracted' (superRefine below).
    subcontractor: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'Own') return;
    if (!data.nationality) ctx.addIssue({ code: 'custom', path: ['nationality'], message: 'Nationality is required.' });
    if (!data.mobile) ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Enter a valid mobile number.' });
    if (!data.joiningDate) ctx.addIssue({ code: 'custom', path: ['joiningDate'], message: 'Joining date is required.' });
    if (data.type === 'Outsourced' && !data.salary) {
      ctx.addIssue({ code: 'custom', path: ['salary'], message: 'Salary is required.' });
    }
    if (data.type === 'Subcontracted' && !data.subcontractor) {
      ctx.addIssue({ code: 'custom', path: ['subcontractor'], message: 'Select who supplied this worker.' });
    }
  });

const emptyDocument = { number: '', expiry: '' };

/** Blank slate for the "new employee" form. */
export const emptyEmployeeForm = {
  employeeId: '',
  fullName: '',
  // 2026-09-30, the user's own ask: this module only ever creates a real
  // 'Own' (internal staff) employee now — a Freelancer or a subcontractor's
  // worker is added through the Outsourced Employees module instead, which
  // already captures their Iqama/nationality/rate and supports the same
  // autofill-by-Iqama lookup Mobilisation itself uses. EmployeeForm hides the
  // type selector entirely on create (see its own isEdit prop) — this is now
  // the only value a brand-new record here can ever have.
  type: 'Own',
  nationality: '',
  mobile: '',
  email: '',
  passport: emptyDocument,
  visa: emptyDocument,
  iqama: emptyDocument,
  medical: emptyDocument,
  drivingLicense: emptyDocument,
  joiningDate: '',
  designation: '',
  department: '',
  salary: '',
  basicSalary: '',
  housingAllowance: '',
  transportAllowance: '',
  accommodation: '',
  expectedDailyHours: '',
  weeklyOffDay: '5', // pre-selected Friday, mirrors the model's create-default
  status: 'Active',
  emergencyContact: { name: '', phone: '', relation: '' },
  notes: '',
  manager: '',
  approvalWorkflow: '',
  subcontractor: '',
};

/** API employee → form values (ISO dates become date-input strings). */
export function employeeToForm(employee) {
  const doc = (d) => ({ number: d?.number ?? '', expiry: toDateInput(d?.expiry) });
  return {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    type: employee.type ?? 'Outsourced',
    nationality: employee.nationality ?? '',
    mobile: employee.mobile ?? '',
    email: employee.email ?? '',
    passport: doc(employee.passport),
    visa: doc(employee.visa),
    iqama: doc(employee.iqama),
    medical: doc(employee.medical),
    drivingLicense: doc(employee.drivingLicense),
    joiningDate: toDateInput(employee.joiningDate),
    designation: employee.designation,
    department: employee.department ?? '',
    salary: employee.salary != null ? String(employee.salary) : '',
    basicSalary: employee.basicSalary != null ? String(employee.basicSalary) : '',
    housingAllowance: employee.housingAllowance != null ? String(employee.housingAllowance) : '',
    transportAllowance: employee.transportAllowance != null ? String(employee.transportAllowance) : '',
    accommodation: employee.accommodation ?? '',
    expectedDailyHours: employee.expectedDailyHours != null ? String(employee.expectedDailyHours) : '',
    weeklyOffDay: employee.weeklyOffDay != null ? String(employee.weeklyOffDay) : '',
    status: employee.status,
    emergencyContact: {
      name: employee.emergencyContact?.name ?? '',
      phone: employee.emergencyContact?.phone ?? '',
      relation: employee.emergencyContact?.relation ?? '',
    },
    notes: employee.notes ?? '',
    manager: employee.manager?._id ?? employee.manager ?? '',
    approvalWorkflow: employee.approvalWorkflow?._id ?? employee.approvalWorkflow ?? '',
    subcontractor: employee.subcontractor?._id ?? employee.subcontractor ?? '',
  };
}

/** Form values → API payload: '' becomes null so an explicit unassign/clear is sent. */
export function formToEmployeePayload(values) {
  return {
    ...values,
    manager: values.manager || null,
    approvalWorkflow: values.approvalWorkflow || null,
    subcontractor: values.subcontractor || null,
    expectedDailyHours: values.expectedDailyHours || null,
    weeklyOffDay: values.weeklyOffDay === '' ? null : values.weeklyOffDay,
    basicSalary: values.basicSalary || null,
    housingAllowance: values.housingAllowance || null,
    transportAllowance: values.transportAllowance || null,
  };
}
