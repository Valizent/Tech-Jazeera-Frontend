/**
 * Deployments API layer — the only file that knows deployment endpoint URLs.
 * No create/edit here on purpose — a Deployment is born automatically once
 * its source Mobilisation is Approved (see mobilisations.api.js).
 */
import { api } from '../../lib/axios.js';

/** GET /deployments — params: page, limit, worker, client, status, sortOrder */
export async function listDeployments(params) {
  const { data } = await api.get('/deployments', { params });
  return data.data; // { items, total, page, pages }
}

export async function getDeployment(id) {
  const { data } = await api.get(`/deployments/${id}`);
  return data.data;
}

/** Record a calendar month's actual client-timesheet hours + OT amount. */
export async function addMonthlyHours(id, payload) {
  const { data } = await api.post(`/deployments/${id}/monthly-hours`, payload);
  return data.data;
}

/** Correct an already-entered month. */
export async function updateMonthlyHours(id, entryId, payload) {
  const { data } = await api.patch(`/deployments/${id}/monthly-hours/${entryId}`, payload);
  return data.data;
}

/** Approve or Reject a Pending month's entry. payload: { decision, note } */
export async function decideMonthlyHours(id, entryId, payload) {
  const { data } = await api.patch(`/deployments/${id}/monthly-hours/${entryId}/decide`, payload);
  return data.data;
}

/** Demobilise — ends this deployment. `payload.reason` decides whether the
 *  worker goes back to standby or exits the company (see deployments.schema.js). */
export async function demobiliseDeployment(id, payload) {
  const { data } = await api.post(`/deployments/${id}/demobilise`, payload);
  return data.data;
}

// TEMPORARY — pre-production cleanup only, Admin-only. Remove this function
// along with its call sites and the server route/service/controller behind
// it before going live.
export async function deleteDeployment(id) {
  await api.delete(`/deployments/${id}`);
}
