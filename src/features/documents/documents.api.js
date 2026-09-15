/**
 * Documents API layer. Uploads send multipart FormData; file preview/download
 * fetch the bytes through the authenticated axios instance (the in-memory
 * access token can't ride on a plain <img>/<a> request), then hand back a Blob
 * the UI can show or save.
 */
import { api } from '../../lib/axios.js';

/** GET /documents — params: ownerType, owner, category, search, expiring, page, limit */
export async function listDocuments(params) {
  const { data } = await api.get('/documents', { params });
  return data.data; // { items, total, page, pages }
}

/** POST /documents (multipart). `formData` carries file + title/category/owner. */
export async function uploadDocument(formData) {
  const { data } = await api.post('/documents', formData);
  return data.data;
}

/** POST /documents/:id/versions (multipart: file). */
export async function addVersion(id, formData) {
  const { data } = await api.post(`/documents/${id}/versions`, formData);
  return data.data;
}

export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}

/** Fetch a file's bytes as a Blob (for inline preview). */
export async function fetchFileBlob(id, version) {
  const res = await api.get(`/documents/${id}/file`, {
    params: version ? { version } : {},
    responseType: 'blob',
  });
  return res.data;
}

/** Fetch and save a file with its original name. */
export async function downloadDocumentFile(id, version, filename) {
  const blob = await fetchFileBlob(id, version);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
