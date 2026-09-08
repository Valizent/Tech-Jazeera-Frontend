/**
 * Client-side deployment form schemas — monthly hours entry/correction and
 * Release. No create/edit schema here on purpose — see deployments.api.js.
 */
import { z } from 'zod';

const optionalStr = (max) => z.string().trim().max(max).optional().or(z.literal(''));

export const monthlyHoursFormSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month.'),
  actualHours: z.string().min(1, 'Enter the actual hours.'),
  otAmount: z.string().optional().or(z.literal('')),
  notes: optionalStr(500),
});

export const emptyMonthlyHoursForm = {
  month: '',
  actualHours: '',
  otAmount: '',
  notes: '',
};

export function monthlyHoursEntryToForm(entry) {
  return {
    month: entry.month,
    actualHours: String(entry.actualHours ?? ''),
    otAmount: String(entry.otAmount ?? ''),
    notes: entry.notes ?? '',
  };
}

export const releaseFormSchema = z.object({
  releaseDate: z.string().min(1, 'Release date is required.'),
  releaseNote: optionalStr(1000),
});

export const emptyReleaseForm = {
  releaseDate: new Date().toISOString().slice(0, 10),
  releaseNote: '',
};
