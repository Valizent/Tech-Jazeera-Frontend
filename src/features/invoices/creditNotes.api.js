/**
 * Credit notes API layer — flat endpoints, `invoice` referenced by id, same
 * shape as invoices.api.js itself (which references `quotation` the same
 * way rather than nesting under it).
 */
import { api } from '../../lib/axios.js';

export async function listCreditNotes(invoiceId) {
  const { data } = await api.get('/credit-notes', { params: { invoice: invoiceId, limit: 100 } });
  return data.data; // { items, total, page, pages }
}

/** Company-wide listing (no invoice filter) — the Credit Notes list page. */
export async function listAllCreditNotes(params) {
  const { data } = await api.get('/credit-notes', { params });
  return data.data;
}

export async function createCreditNote(payload) {
  const { data } = await api.post('/credit-notes', payload);
  return data.data;
}

/** Download the credit note PDF, named by its number. */
export async function downloadCreditNotePdf(id, creditNoteNumber) {
  const res = await api.get(`/credit-notes/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${creditNoteNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
