/**
 * Daily Updates API layer — the only file that knows these endpoint URLs.
 */
import { api } from '../../lib/axios.js';

export async function listDailyUpdates(params) {
  const { data } = await api.get('/daily-updates', { params });
  return data.data; // { items, total, page, pages }
}

/** Active coordinators — for the "assign to" picker and the coordinator filter. */
export async function listCoordinators() {
  const { data } = await api.get('/daily-updates/coordinators');
  return data.data; // [{ _id, name }]
}

export async function createDailyUpdate(payload) {
  const { data } = await api.post('/daily-updates', payload);
  return data.data;
}

export async function updateDailyUpdate(id, payload) {
  const { data } = await api.patch(`/daily-updates/${id}`, payload);
  return data.data;
}

export async function setTaskStatus(id, status) {
  const { data } = await api.patch(`/daily-updates/${id}/status`, { status });
  return data.data;
}

export async function deleteDailyUpdate(id) {
  const { data } = await api.delete(`/daily-updates/${id}`);
  return data.data;
}
