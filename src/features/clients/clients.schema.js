/**
 * Client-side client form schema + form<->API mapping.
 *
 * The tricky part is `sites`: a dynamic list the user grows/shrinks. The form
 * lets a site row be partly blank; `formToPayload` drops any row without a
 * name (treating it as "not filled in") before sending. The server's schema
 * is the real gate (site name required there).
 */
import { z } from 'zod';
import { CLIENT_STATUSES } from '../../lib/constants.js';

const optional = z.string().trim().max(300).optional().or(z.literal(''));
const optionalPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,18}$/, 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''));

export const clientFormSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required.').max(150),
  contactPerson: optional,
  phone: optionalPhone,
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  address: optional,
  // Validate the KSA fixed lengths only when something is entered.
  vatNumber: z.union([z.literal(''), z.string().regex(/^\d{15}$/, 'Saudi VAT number is 15 digits.')]),
  crNumber: z.union([z.literal(''), z.string().regex(/^\d{10}$/, 'Commercial Registration is 10 digits.')]),
  industry: optional,
  status: z.enum(CLIENT_STATUSES),
  // Site name is optional at the form layer so an empty trailing row doesn't
  // block submit; empty rows are stripped in formToPayload.
  sites: z.array(z.object({ name: optional, city: optional, address: optional })),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

/** Blank slate for the "new client" form. */
export const emptyClientForm = {
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  vatNumber: '',
  crNumber: '',
  industry: '',
  creditLimitDays: '50',
  status: 'Active',
  sites: [],
  notes: '',
};

/** API client → form values. */
export function clientToForm(client) {
  return {
    companyName: client.companyName,
    contactPerson: client.contactPerson ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    vatNumber: client.vatNumber ?? '',
    crNumber: client.crNumber ?? '',
    industry: client.industry ?? '',
    creditLimitDays: client.creditLimitDays?.toString() ?? '50',
    status: client.status,
    sites: (client.sites ?? []).map((s) => ({
      name: s.name ?? '',
      city: s.city ?? '',
      address: s.address ?? '',
    })),
    notes: client.notes ?? '',
  };
}

/** Form values → API payload: drop unnamed site rows. */
export function formToPayload(values) {
  return {
    ...values,
    sites: values.sites.filter((s) => s.name.trim() !== ''),
  };
}
