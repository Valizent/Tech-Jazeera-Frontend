/**
 * Section Access API layer. Every route here is Admin-only server-side —
 * a 403 means the viewer isn't Admin, not that something's broken.
 */
import { api } from '../../lib/axios.js';

export async function listSectionAccess() {
  const { data } = await api.get('/section-access');
  return data.data;
}

export async function updateSectionAccess(sectionKey, payload) {
  const { data } = await api.patch(`/section-access/${sectionKey}`, payload);
  return data.data;
}
