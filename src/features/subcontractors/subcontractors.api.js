/**
 * Subcontractors API layer — the only file that knows subcontractor endpoint URLs.
 */
import { api } from '../../lib/axios.js';

export async function listSubcontractors(params) {
  const { data } = await api.get('/subcontractors', { params });
  return data.data; // { items, total, page, pages }
}

export async function getSubcontractor(id) {
  const { data } = await api.get(`/subcontractors/${id}`);
  return data.data;
}

export async function createSubcontractor(payload) {
  const { data } = await api.post('/subcontractors', payload);
  return data.data;
}

export async function updateSubcontractor(id, payload) {
  const { data } = await api.patch(`/subcontractors/${id}`, payload);
  return data.data;
}

export async function deleteSubcontractor(id) {
  const { data } = await api.delete(`/subcontractors/${id}`);
  return data.data;
}
