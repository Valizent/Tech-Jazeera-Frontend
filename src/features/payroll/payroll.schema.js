/**
 * Client-side schema for editing one Draft payroll line — instant feedback;
 * the server's Zod layer (and the actual pay math) is the real gatekeeper.
 */
import { z } from 'zod';

export const deductionLineSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.').max(100),
  amount: z.string().min(1, 'Amount is required.'),
});

export const payrollLineFormSchema = z.object({
  otherAllowances: z.string().optional().or(z.literal('')),
  gosiDeduction: z.string().optional().or(z.literal('')),
  otherDeductions: z.array(deductionLineSchema),
  advanceRepaymentAmount: z.string().optional().or(z.literal('')),
});

export function lineToForm(line) {
  return {
    otherAllowances: line.otherAllowances ? String(line.otherAllowances) : '',
    gosiDeduction: line.gosiDeduction ? String(line.gosiDeduction) : '',
    otherDeductions: (line.otherDeductions ?? []).map((d) => ({ label: d.label, amount: String(d.amount) })),
    advanceRepaymentAmount: line.advanceRepayment?.advance ? String(line.advanceRepayment.amount) : '',
  };
}

export function formToLinePayload(values) {
  return {
    otherAllowances: values.otherAllowances || 0,
    gosiDeduction: values.gosiDeduction || 0,
    otherDeductions: values.otherDeductions.map((d) => ({ label: d.label, amount: Number(d.amount) })),
    advanceRepaymentAmount: values.advanceRepaymentAmount === '' ? undefined : Number(values.advanceRepaymentAmount),
  };
}
