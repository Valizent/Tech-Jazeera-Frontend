/**
 * Expenses API layer (P2-M7). Create is multipart (an optional receipt
 * file); update/list/get/delete are plain JSON, same split as reimbursement
 * claims vs. their review actions.
 */
import { api } from '../../lib/axios.js';

export async function listExpenses(params) {
  const { data } = await api.get('/expenses', { params });
  return data.data; // { items, total, page, pages }
}

export async function getExpenseSummary(params) {
  const { data } = await api.get('/expenses/summary', { params });
  return data.data; // { from, to, total, byCategory }
}

/** `formData` carries the text fields plus an optional `file` (the receipt). */
export async function createExpense(formData) {
  const { data } = await api.post('/expenses', formData);
  return data.data;
}

export async function updateExpense(id, payload) {
  const { data } = await api.patch(`/expenses/${id}`, payload);
  return data.data;
}

export async function deleteExpense(id) {
  const { data } = await api.delete(`/expenses/${id}`);
  return data.data;
}

/** Download an expense's receipt as an authenticated Blob. */
export async function downloadExpenseReceipt(id, originalName) {
  const res = await api.get(`/expenses/${id}/receipt`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName || 'receipt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
