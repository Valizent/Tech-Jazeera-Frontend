/**
 * Holidays API layer — the company holiday calendar (P3-B). Read stays open
 * to any authenticated user, unconditionally; create/update/delete is gated
 * server-side by the admin-configurable Section Access 'holidays' write
 * grant (see docs/SECTION-ACCESS-notes.md).
 */
import { api } from '../../lib/axios.js';

export async function listHolidays(params) {
  const { data } = await api.get('/holidays', { params });
  return data.data;
}

export async function createHoliday(payload) {
  const { data } = await api.post('/holidays', payload);
  return data.data;
}

export async function updateHoliday(id, payload) {
  const { data } = await api.patch(`/holidays/${id}`, payload);
  return data.data;
}

export async function deleteHoliday(id) {
  const { data } = await api.delete(`/holidays/${id}`);
  return data.data;
}
