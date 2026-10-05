/**
 * Client-side subcontractor schema — instant feedback; the server's Zod
 * layer is the real gatekeeper (same split as everywhere else in this app).
 */
import { z } from 'zod';

export const subcontractorFormSchema = z.object({
  name: z.string().trim().min(2, 'Subcontractor name is required.').max(150),
  industry: z.string().trim().max(150).optional().or(z.literal('')),
  contactPerson: z.string().trim().max(100).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().max(150).optional().or(z.literal('')),
  creditLimitDays: z.string().trim().optional().or(z.number()),
  vatNumber: z.string().trim().max(15).optional().or(z.literal('')),
  crNumber: z.string().trim().max(10).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const emptySubcontractorForm = {
  name: '',
  industry: '',
  contactPerson: '',
  phone: '',
  email: '',
  creditLimitDays: '30',
  vatNumber: '',
  crNumber: '',
  address: '',
  status: 'Active',
  notes: '',
};

export function subcontractorToForm(subcontractor) {
  return {
    name: subcontractor.name,
    industry: subcontractor.industry ?? '',
    contactPerson: subcontractor.contactPerson ?? '',
    phone: subcontractor.phone ?? '',
    email: subcontractor.email ?? '',
    creditLimitDays: subcontractor.creditLimitDays != null ? String(subcontractor.creditLimitDays) : '',
    vatNumber: subcontractor.vatNumber ?? '',
    crNumber: subcontractor.crNumber ?? '',
    address: subcontractor.address ?? '',
    status: subcontractor.status,
    notes: subcontractor.notes ?? '',
  };
}
