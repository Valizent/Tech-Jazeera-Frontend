/**
 * Locations API — the shared, admin-manageable "site / location" picklist
 * behind Mobilisation's and Requirement's `site` field. Read/create are open
 * to any staff role; delete is Admin-only server-side (see location.routes.js).
 */
import { api } from '../../lib/axios.js';

export async function listLocations() {
  const { data } = await api.get('/locations');
  return data.data; // [{ _id, name }]
}

export async function createLocation(name) {
  const { data } = await api.post('/locations', { name });
  return data.data;
}

export async function deleteLocation(id) {
  await api.delete(`/locations/${id}`);
}
