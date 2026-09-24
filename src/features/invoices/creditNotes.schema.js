/**
 * Client-side schema for issuing a credit note — instant feedback; the
 * server's Zod layer (and the actual money math) is the real gatekeeper,
 * same split as everywhere else in this app.
 */
import { z } from 'zod';

export const creditNoteLineItemSchema = z.object({
  type: z.string().min(1, 'Choose a type.'),
  description: z.string().trim().min(1, 'Description is required.'),
  quantity: z.string().min(1, 'Required.'),
  unitPrice: z.string().min(1, 'Required.'),
  discount: z.string().optional().or(z.literal('')),
  taxRate: z.string().optional().or(z.literal('')),
});

export const creditNoteFormSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.').max(1000),
  lineItems: z.array(creditNoteLineItemSchema).min(1, 'At least one line item is required.'),
});

export function emptyCreditNoteLine() {
  return { type: 'Labour', description: '', quantity: '1', unitPrice: '', discount: '0', taxRate: '15' };
}

export const emptyCreditNoteForm = { reason: '', lineItems: [emptyCreditNoteLine()] };

export function formToCreditNotePayload(values, invoiceId) {
  return {
    invoice: invoiceId,
    reason: values.reason,
    lineItems: values.lineItems.map((li) => ({
      type: li.type,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      discount: li.discount ? Number(li.discount) : 0,
      taxRate: li.taxRate ? Number(li.taxRate) : 0,
    })),
  };
}
