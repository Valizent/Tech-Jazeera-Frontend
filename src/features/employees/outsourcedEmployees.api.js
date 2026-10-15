import { api } from '../../lib/axios.js';

export async function listOutsourcedEmployees({ search, workerType } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (workerType) params.set('workerType', workerType);
  const { data } = await api.get(`/outsourced-employees?${params.toString()}`);
  return data.data;
}

export async function getOutsourcedEmployee(id) {
  const { data } = await api.get(`/outsourced-employees/${id}`);
  return data.data;
}

export async function createOutsourcedEmployee(employee) {
  const { data } = await api.post('/outsourced-employees', employee);
  return data.data;
}

export async function updateOutsourcedEmployee(id, employee) {
  const { data } = await api.patch(`/outsourced-employees/${id}`, employee);
  return data.data;
}

export async function deleteOutsourcedEmployee(id) {
  await api.delete(`/outsourced-employees/${id}`);
}

// ---- documents ----

/**
 * Record a document. `details`: { type, title? (for Other), number?, expiryDate?, reminderDays? }; `file` is an
 * optional File object (it can be attached later).
 */
export async function saveOutsourcedEmployeeDocument(id, details, file) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  }
  if (file) formData.append('file', file);
  const { data } = await api.post(`/outsourced-employees/${id}/documents`, formData);
  return data.data;
}

/** Change a document's details (and optionally put a new file on it). `clearExpiry: true` removes the date. */
export async function updateOutsourcedEmployeeDocument(id, fileId, details, file) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  }
  if (file) formData.append('file', file);
  const { data } = await api.patch(`/outsourced-employees/${id}/documents/${fileId}`, formData);
  return data.data;
}

export async function deleteOutsourcedEmployeeDocument(id, fileId) {
  const { data } = await api.delete(`/outsourced-employees/${id}/documents/${fileId}`);
  return data.data;
}

/** Downloads a document as an authenticated Blob — a plain <a>/<img> can't
 *  send the in-memory bearer token. */
export async function downloadOutsourcedEmployeeDocument(id, fileId, originalName) {
  const res = await api.get(`/outsourced-employees/${id}/documents/${fileId}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
