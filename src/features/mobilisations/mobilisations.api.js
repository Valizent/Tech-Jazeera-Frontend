/**
 * Mobilisations API layer — the only file that knows mobilisation endpoint
 * URLs. M1 CRUD, plus M2 (coordinators/submit), M3 (Marketing Manager
 * review), M5 (documents).
 */
import { api } from '../../lib/axios.js';

export async function listMobilisations(params) {
  const { data } = await api.get('/mobilisations', { params });
  return data.data; // { items, total, page, pages }
}

/** Minimal picker source for inviting a joint coordinator — {_id, name} only. */
export async function listCoordinatorCandidates() {
  const { data } = await api.get('/mobilisations/coordinators');
  return data.data;
}

/** Live autocomplete for a free-typed worker-identity field (SupplierEmployee/
 *  Freelancer only — see MobilisationForm) — string[] of past values. */
export async function getMobilisationSuggestions(field) {
  const { data } = await api.get('/mobilisations/suggestions', { params: { field } });
  return data.data;
}

export async function getMobilisation(id) {
  const { data } = await api.get(`/mobilisations/${id}`);
  return data.data;
}

/** Download this one mobilisation as a .xlsx (an authenticated Blob — a
 *  plain <a>/<img> can't send the in-memory bearer token). */
export async function downloadMobilisationExport(id, serialNumber) {
  const res = await api.get(`/mobilisations/${id}/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mobilisation_${serialNumber}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download every mobilisation matching the given list filters as one
 *  .xlsx (same filters the list page itself uses — status/client/worker/
 *  search/sort — pagination doesn't apply to an export). */
export async function downloadMobilisationsExport(filters) {
  const res = await api.get('/mobilisations/export', { params: filters, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mobilisations_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function createMobilisation(payload) {
  const { data } = await api.post('/mobilisations', payload);
  return data.data;
}

export async function updateMobilisation(id, payload) {
  const { data } = await api.patch(`/mobilisations/${id}`, payload);
  return data.data;
}

// TEMPORARY — pre-production cleanup only, Admin-only. Remove this function
// along with its call sites and the server route/service/controller behind
// it before going live.
export async function deleteMobilisation(id) {
  await api.delete(`/mobilisations/${id}`);
}

// --- M2: joint coordinators + submit ---

export async function addCoordinator(id, userId) {
  const { data } = await api.post(`/mobilisations/${id}/coordinators`, { user: userId });
  return data.data;
}

export async function removeCoordinator(id, userId) {
  const { data } = await api.delete(`/mobilisations/${id}/coordinators/${userId}`);
  return data.data;
}

export async function confirmCoordinator(id, userId) {
  const { data } = await api.patch(`/mobilisations/${id}/coordinators/${userId}/confirm`);
  return data.data;
}

export async function submitMobilisation(id) {
  const { data } = await api.post(`/mobilisations/${id}/submit`);
  return data.data;
}


// --- M3: Marketing Manager review ---

export async function saveCommercialDetails(id, payload) {
  const { data } = await api.patch(`/mobilisations/${id}/commercial-details`, payload);
  return data.data;
}

export async function decideMobilisation(id, payload) {
  const { data } = await api.patch(`/mobilisations/${id}/decide`, payload);
  return data.data;
}

// --- M5: documents ---

/** `files` is an array of File objects; `category` one of Contract/IDCopy/Other. */
export async function uploadMobilisationDocuments(id, files, category) {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  formData.append('category', category);
  const { data } = await api.post(`/mobilisations/${id}/documents`, formData);
  return data.data;
}

export async function deleteMobilisationDocument(id, fileId) {
  const { data } = await api.delete(`/mobilisations/${id}/documents/${fileId}`);
  return data.data;
}

/** Download a mobilisation document as an authenticated Blob (mirrors
 *  expenses.api.js's downloadExpenseReceipt — the in-memory bearer token
 *  can't be sent by a plain <a>/<img>). */
export async function downloadMobilisationDocument(id, fileId, originalName) {
  const res = await api.get(`/mobilisations/${id}/documents/${fileId}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fetch a mobilisation document's bytes as a Blob, for inline preview
 *  (mirrors documents.api.js's fetchFileBlob) — no download side effect,
 *  the caller turns it into an object URL itself. */
export async function fetchMobilisationDocumentBlob(id, fileId) {
  const res = await api.get(`/mobilisations/${id}/documents/${fileId}/file`, { responseType: 'blob' });
  return res.data;
}
