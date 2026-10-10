/**
 * Annual Vacation API layer. The staff review queue and a staff login's own
 * requests live under /api/annual-vacation; a Worker/Staff login's own
 * submit/list/cancel use /api/me (features/ess/ess.api.js re-exports below).
 */
import { api } from '../../lib/axios.js';

/** Query keys, shared by the review queue and whoever invalidates it after a submit. */
export const VACATION_QUEUE_KEY = ['annual-vacation', 'queue'];
export const MY_VACATION_REQUESTS_KEY = ['annual-vacation', 'mine'];

/** File a request: for yourself (omit `employee`) or, with Write on the section, for another employee. */
export async function submitAnnualVacation(payload) {
  const { data } = await api.post('/annual-vacation', payload);
  return data.data;
}

/** The staff review queue. */
export async function listAnnualVacation(params) {
  const { data } = await api.get('/annual-vacation', { params });
  return data.data; // { items, total, page, pages }
}

/** A staff login's own requests. */
export async function listMyStaffAnnualVacation(params) {
  const { data } = await api.get('/annual-vacation/mine', { params });
  return data.data;
}

export async function cancelStaffAnnualVacation(id) {
  const { data } = await api.patch(`/annual-vacation/${id}/cancel`);
  return data.data;
}

export async function decideAnnualVacation(id, payload) {
  const { data } = await api.patch(`/annual-vacation/${id}/decide`, payload);
  return data.data;
}

/** A Worker/Staff ESS login's own requests. */
export async function listMyAnnualVacation(params) {
  const { data } = await api.get('/me/annual-vacation', { params });
  return data.data;
}

export async function submitMyAnnualVacation(payload) {
  const { data } = await api.post('/me/annual-vacation', payload);
  return data.data;
}

export async function cancelMyAnnualVacation(id) {
  const { data } = await api.patch(`/me/annual-vacation/${id}/cancel`);
  return data.data;
}
