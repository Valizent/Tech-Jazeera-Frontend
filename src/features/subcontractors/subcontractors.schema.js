/**
 * Client-side subcontractor schema — instant feedback; the server's Zod
 * layer is the real gatekeeper (same split as everywhere else in this app).
 * The company profile fields (Arabic name, National Address, Finance person,
 * Owner, coordinators) are shared with the client form.
 */
import { z } from 'zod';
import {
  companyProfileFormShape,
  emptyCompanyProfile,
  companyProfileToForm,
  companyProfileToPayload,
} from '../companyProfile/companyProfile.schema.js';

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
  ...companyProfileFormShape,
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
  ...emptyCompanyProfile,
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
    ...companyProfileToForm(subcontractor),
  };
}

/** Form values -> API payload (the profile slice drops blank coordinator rows and clears a blank date). */
export function subcontractorToPayload(values) {
  return { ...values, ...companyProfileToPayload(values) };
}
