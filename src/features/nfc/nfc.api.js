/**
 * NFC platform API layer — companies, people, card inventory, batches, and the
 * card lifecycle. Each call returns the `data` from { success, message, data };
 * the QR and CSV helpers fetch binary through the authenticated axios instance.
 */
import { api } from '../../lib/axios.js';

// Companies
export async function listNfcCompanies(params) {
  const { data } = await api.get('/nfc/companies', { params });
  return data.data;
}
export async function getNfcCompany(id) {
  const { data } = await api.get(`/nfc/companies/${id}`);
  return data.data;
}
export async function createNfcCompany(payload) {
  const { data } = await api.post('/nfc/companies', payload);
  return data.data;
}
export async function updateNfcCompany(id, payload) {
  const { data } = await api.patch(`/nfc/companies/${id}`, payload);
  return data.data;
}
export async function deleteNfcCompany(id) {
  await api.delete(`/nfc/companies/${id}`);
}

export async function uploadNfcCompanyLogo(id, file) {
  const fd = new FormData();
  fd.append('image', file);
  const { data } = await api.post(`/nfc/companies/${id}/logo`, fd);
  return data.data; // { logoUrl }
}
export async function removeNfcCompanyLogo(id) {
  const { data } = await api.delete(`/nfc/companies/${id}/logo`);
  return data.data;
}

// People
export async function createNfcEmployee(payload) {
  const { data } = await api.post('/nfc/employees', payload);
  return data.data;
}
export async function updateNfcEmployee(id, payload) {
  const { data } = await api.patch(`/nfc/employees/${id}`, payload);
  return data.data;
}
export async function deleteNfcEmployee(id) {
  await api.delete(`/nfc/employees/${id}`);
}
export async function uploadNfcEmployeePhoto(id, file) {
  const fd = new FormData();
  fd.append('image', file);
  const { data } = await api.post(`/nfc/employees/${id}/photo`, fd);
  return data.data; // { photoUrl }
}
export async function removeNfcEmployeePhoto(id) {
  const { data } = await api.delete(`/nfc/employees/${id}/photo`);
  return data.data;
}

// Batches
export async function generateNfcBatch(payload) {
  const { data } = await api.post('/nfc/batches', payload);
  return data.data;
}
/** Download a batch's cards as CSV. */
export async function downloadBatchCsv(batchId, label) {
  const res = await api.get(`/nfc/batches/${batchId}/cards.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nfc_batch_${(label || batchId).replace(/[^\w-]/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Cards
export async function listNfcCards(params) {
  const { data } = await api.get('/nfc/cards', { params });
  return data.data;
}
export async function getNfcCard(id) {
  const { data } = await api.get(`/nfc/cards/${id}`);
  return data.data;
}
export async function updateNfcCard(id, payload) {
  const { data } = await api.patch(`/nfc/cards/${id}`, payload);
  return data.data;
}
export async function assignNfcCard(id, employeeId) {
  const { data } = await api.post(`/nfc/cards/${id}/assign`, { employee: employeeId });
  return data.data;
}
export async function assignNfcCardToCompany(id, companyId) {
  const { data } = await api.post(`/nfc/cards/${id}/assign-company`, { company: companyId });
  return data.data;
}
export async function deleteNfcCard(id) {
  await api.delete(`/nfc/cards/${id}`);
}
/** Lifecycle action: 'unassign' | 'lost' | 'return' | 'disable' | 'rotate'. */
export async function cardAction(id, action) {
  const { data } = await api.post(`/nfc/cards/${id}/${action}`);
  return data.data;
}
/** Fetch the card's QR PNG as an object URL (authenticated). */
export async function getCardQrObjectUrl(id) {
  const res = await api.get(`/nfc/cards/${id}/qr.png`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}
/** Fetch the offline-contact QR PNG (vCard encoded directly, no URL) as an object URL. */
export async function getCardQrOfflineObjectUrl(id) {
  const res = await api.get(`/nfc/cards/${id}/qr-offline.png`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

// Analytics — `days` is the trailing window (1–365, default 30 server-side).
export async function getNfcOverviewAnalytics(days) {
  const { data } = await api.get('/nfc/analytics', { params: { days } });
  return data.data;
}
export async function getNfcCardAnalytics(id, days) {
  const { data } = await api.get(`/nfc/cards/${id}/analytics`, { params: { days } });
  return data.data;
}
export async function getNfcCompanyAnalytics(id, days) {
  const { data } = await api.get(`/nfc/companies/${id}/analytics`, { params: { days } });
  return data.data;
}
