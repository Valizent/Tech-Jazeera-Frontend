/**
 * Client-side settlement form schema — instant feedback; the server's Zod
 * layer (and the actual EOSB math) is the real gatekeeper.
 */
import { z } from 'zod';

export const settlementFormSchema = z.object({
  employee: z.string().min(1, 'Choose the exiting employee.'),
  exitDate: z.string().min(1, 'Exit date is required.'),
  exitReason: z.string().min(1, 'Choose why the employee is exiting.'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  overrideEosbGross: z.string().optional().or(z.literal('')).refine(s => !s || !isNaN(Number(s)), 'Must be a number'),
  overrideLeaveDays: z.string().optional().or(z.literal('')).refine(s => !s || !isNaN(Number(s)), 'Must be a number'),
  overrideLeaveEncashment: z.string().optional().or(z.literal('')).refine(s => !s || !isNaN(Number(s)), 'Must be a number'),
});

export const emptySettlementForm = { 
  employee: '', 
  exitDate: '', 
  exitReason: '', 
  notes: '',
  overrideEosbGross: '',
  overrideLeaveDays: '',
  overrideLeaveEncashment: ''
};
