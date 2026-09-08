/**
 * Staff-panel "my details" API layer — hits /api/profile, a standalone
 * endpoint for the full staff panel (Manager, HR, Accounts, Coordinator,
 * Executive, Office Secretary). Worker/Staff have the equivalent under the
 * ESS portal's own /api/me (see features/ess/ess.api.js) — kept separate
 * server-side (see server/src/modules/me/profile.routes.js) so this never
 * grants those roles the rest of the ESS surface (leave/attendance/etc).
 */
import { api } from '../../lib/axios.js';

export async function getMyProfile() {
  const { data } = await api.get('/profile');
  return data.data;
}

export async function updateMyProfile(payload) {
  const { data } = await api.patch('/profile', payload);
  return data.data;
}
