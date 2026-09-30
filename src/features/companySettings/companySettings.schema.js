/**
 * Client-side Company Settings form schema — mirrors
 * server/companySettings.validation.js. Every field is optional; a company
 * can fill this in gradually. Form values are all strings; "" is sent as
 * null server-side to explicitly clear a field.
 */
import { z } from 'zod';

const optional = z.string().trim().max(300).optional().or(z.literal(''));

// Fixed 2026-09-29, a real audit finding: bankIban had no format/checksum
// check at all, even though it's printed verbatim on every outstanding
// invoice's Payment Instructions section — a typo'd IBAN would save and
// print silently, a real misdirected-payment risk. Real ISO 13616
// structural + MOD-97 (ISO 7064) checksum validation, works for any
// country's IBAN, not just Saudi's.
function isValidIban(value) {
  const cleaned = value.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
const optionalIban = z
  .string()
  .trim()
  .max(34)
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || isValidIban(v), 'Enter a valid IBAN.');

export const companySettingsFormSchema = z.object({
  companyName: optional,
  companyNameAr: optional,
  crNumber: optional,
  vatNumber: optional,
  address: optional,
  phone: optional,
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  website: optional,
  bankName: optional,
  bankIban: optionalIban,
  signatoryName: optional,
  signatoryTitle: optional,
});

export const emptyCompanySettingsForm = {
  companyName: '',
  companyNameAr: '',
  crNumber: '',
  vatNumber: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  bankIban: '',
  signatoryName: '',
  signatoryTitle: '',
};

/** API settings → form values (null becomes ""). */
export function companySettingsToForm(settings) {
  const form = { ...emptyCompanySettingsForm };
  for (const key of Object.keys(form)) {
    form[key] = settings?.[key] ?? '';
  }
  return form;
}
