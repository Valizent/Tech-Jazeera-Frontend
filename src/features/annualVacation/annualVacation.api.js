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

/** Can this person ask for vacation yet, and how many days their contract gives. `employeeId` omitted = yourself. */
export async function getVacationEligibility(employeeId) {
  const { data } = await api.get('/annual-vacation/eligibility', { params: employeeId ? { employee: employeeId } : {} });
  return data.data; // { eligible, reason, contractDays }
}

export async function getMyVacationEligibility() {
  const { data } = await api.get('/me/annual-vacation/eligibility');
  return data.data;
}

/** HR changing the days at the HR step. */
export async function changeVacationDays(id, payload) {
  const { data } = await api.patch(`/annual-vacation/${id}/days`, payload);
  return data.data;
}

/** Accounts attaching the air tickets with the day of travel. `files` is an array of File objects. */
export async function attachVacationTickets(id, { files, travelDate }) {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  formData.append('travelDate', travelDate);
  const { data } = await api.post(`/annual-vacation/${id}/tickets`, formData);
  return data.data;
}

export async function removeVacationTicket(id, fileId) {
  const { data } = await api.delete(`/annual-vacation/${id}/tickets/${fileId}`);
  return data.data;
}

/** Accounts uploading the issued re-entry visa. */
export async function uploadVacationVisa(id, { file, visaReferenceNumber }) {
  const formData = new FormData();
  formData.append('file', file);
  if (visaReferenceNumber?.trim()) formData.append('visaReferenceNumber', visaReferenceNumber.trim());
  const { data } = await api.post(`/annual-vacation/${id}/visa`, formData);
  return data.data;
}

/** A stored file comes back as an authenticated Blob (a plain link cannot send the in-memory token). */
async function downloadBlob(path, fallbackName) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Staff side (anyone who may see the request) and the employee's own side (/api/me). */
export const downloadVacationTicket = (id, fileId, name) => downloadBlob(`/annual-vacation/${id}/tickets/${fileId}/file`, name);
export const downloadVacationVisa = (id, name) => downloadBlob(`/annual-vacation/${id}/visa/file`, name);
export const downloadMyVacationTicket = (id, fileId, name) => downloadBlob(`/me/annual-vacation/${id}/tickets/${fileId}/file`, name);
export const downloadMyVacationVisa = (id, name) => downloadBlob(`/me/annual-vacation/${id}/visa/file`, name);
