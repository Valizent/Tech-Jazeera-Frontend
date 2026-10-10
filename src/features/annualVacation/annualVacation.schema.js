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
  requestedDays: z
    .string()
    .min(1, 'Enter the number of days.')
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= MAX_VACATION_DAYS, {
      message: `Enter a whole number of days from 1 to ${MAX_VACATION_DAYS}.`,
    }),
  reason: z.string().max(1000, 'Keep the reason under 1000 characters.').optional(),
});

export const emptyAnnualVacationForm = { employee: '', startDate: '', requestedDays: '', reason: '' };

/** Form values -> API payload (numbers as numbers, blanks dropped). */
export function toAnnualVacationPayload(values) {
  return {
    ...(values.employee && { employee: values.employee }),
    startDate: values.startDate,
    requestedDays: Number(values.requestedDays),
    ...(values.reason?.trim() && { reason: values.reason.trim() }),
  };
}
