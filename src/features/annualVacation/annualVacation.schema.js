/**
 * Zod schema for the Annual Vacation request form. Mirrors
 * annualVacation.validation.js on the server, which stays the real check.
 */
import { z } from 'zod';

export const MAX_VACATION_DAYS = 90;

export const annualVacationFormSchema = z.object({
  // '' = file for myself; an employee id = file on their behalf (needs Write).
  employee: z.string().optional(),
  startDate: z.string().min(1, 'Choose the first day of the vacation.'),
  // The number of days is the contract's (set by HR on the employee record), so it is not a field.
  reason: z.string().max(1000, 'Keep the notes under 1000 characters.').optional(),
});

export const emptyAnnualVacationForm = { employee: '', startDate: '', reason: '' };

/** Form values -> API payload (blanks dropped). */
export function toAnnualVacationPayload(values) {
  return {
    ...(values.employee && { employee: values.employee }),
    startDate: values.startDate,
    ...(values.reason?.trim() && { reason: values.reason.trim() }),
  };
}
