/**
 * Company profile form pieces shared by the client and subcontractor forms
 * (2026-10-12): Arabic name, CR expiry, contact position, National Address,
 * Finance person, Owner and the company's coordinators.
 *
 * Everything is optional: a company can be saved incomplete and is flagged
 * "missing details" afterwards. The server's Zod schema is the real gate.
 */
import { z } from 'zod';

const optional = z.string().trim().max(150).optional().or(z.literal(''));
const optionalPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,18}$/, 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''));
const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address.')]);
const digitsOrEmpty = (count, label) =>
  z.union([z.literal(''), z.string().trim().regex(new RegExp(`^\\d{${count}}$`), `${label} is ${count} digits.`)]);

const person = z.object({ name: optional, position: optional, phone: optionalPhone, email: optionalEmail });

const coordinatorRow = z
  .object({ _id: z.string().optional(), name: optional, designation: optional, phone: optionalPhone, email: optionalEmail })
  .superRefine((row, ctx) => {
    const hasDetail = [row.designation, row.phone, row.email].some((v) => v && v.trim() !== '');
    if (hasDetail && !row.name?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Coordinator name is required.' });
    }
  });

/** Spread into a form's z.object({...}). */
export const companyProfileFormShape = {
  arabicName: optional,
  crExpiry: z.string().optional().or(z.literal('')),
  contactPosition: optional,
  financePerson: person,
  owner: person,
  nationalAddress: z.object({
    buildingNumber: digitsOrEmpty(4, 'Building number'),
    streetName: optional,
    district: optional,
    city: optional,
    postalCode: digitsOrEmpty(5, 'Postal code'),
    additionalNumber: digitsOrEmpty(4, 'Additional number'),
    unitNumber: z.union([z.literal(''), z.string().trim().regex(/^\d{1,4}$/, 'Unit number is up to 4 digits.')]),
    shortAddress: z.union([z.literal(''), z.string().trim().regex(/^[A-Za-z]{4}\d{4}$/, 'Short address is 4 letters then 4 digits (e.g. RRRD2929).')]),
  }),
  coordinators: z.array(coordinatorRow),
};

const emptyPerson = { name: '', position: '', phone: '', email: '' };

export const emptyCompanyProfile = {
  arabicName: '',
  crExpiry: '',
  contactPosition: '',
  financePerson: { ...emptyPerson },
  owner: { ...emptyPerson },
  nationalAddress: {
    buildingNumber: '',
    streetName: '',
    district: '',
    city: '',
    postalCode: '',
    additionalNumber: '',
    unitNumber: '',
    shortAddress: '',
  },
  coordinators: [],
};

export const emptyCoordinatorRow = { name: '', designation: '', phone: '', email: '' };

const text = (v) => v ?? '';
const personToForm = (p) => ({ name: text(p?.name), position: text(p?.position), phone: text(p?.phone), email: text(p?.email) });

/** API company -> the profile slice of the form values. */
export function companyProfileToForm(company) {
  const a = company.nationalAddress ?? {};
  return {
    arabicName: text(company.arabicName),
    crExpiry: company.crExpiry ? String(company.crExpiry).slice(0, 10) : '',
    contactPosition: text(company.contactPosition),
    financePerson: personToForm(company.financePerson),
    owner: personToForm(company.owner),
    nationalAddress: {
      buildingNumber: text(a.buildingNumber),
      streetName: text(a.streetName),
      district: text(a.district),
      city: text(a.city),
      postalCode: text(a.postalCode),
      additionalNumber: text(a.additionalNumber),
      unitNumber: text(a.unitNumber),
      shortAddress: text(a.shortAddress),
    },
    coordinators: (company.coordinators ?? []).map((c) => ({
      _id: c._id,
      name: text(c.name),
      designation: text(c.designation),
      phone: text(c.phone),
      email: text(c.email),
    })),
  };
}

/** Form values -> the profile slice of the API payload (blank rows dropped, blank date clears). */
export function companyProfileToPayload(values) {
  return {
    arabicName: values.arabicName,
    crExpiry: values.crExpiry === '' ? null : values.crExpiry,
    contactPosition: values.contactPosition,
    financePerson: values.financePerson,
    owner: values.owner,
    nationalAddress: values.nationalAddress,
    coordinators: values.coordinators
      .filter((c) => c.name.trim() !== '')
      .map(({ _id, ...rest }) => (_id ? { _id, ...rest } : rest)),
  };
}
