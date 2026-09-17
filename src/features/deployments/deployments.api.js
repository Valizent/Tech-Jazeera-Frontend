/**
 * Deployments API layer — the only file that knows deployment endpoint URLs.
 * No CREATE here on purpose — a Deployment is born automatically once its
 * source Mobilisation is Approved (see mobilisations.api.js). A narrow EDIT
 * exists (2026-09-16, the user's own ask) — see updateDeployment below.
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

/** Download every deployment matching the given list filters as one .xlsx
 *  (same filters the register itself uses — worker/client/status/sortOrder;
 *  pagination doesn't apply to an export). 2026-09-16, the user's own ask. */
export async function downloadDeploymentsExport(filters) {
  const res = await api.get('/deployments/export', { params: filters, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deployments_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Correct a deployment's own recorded details — site/worker name/contracted
 *  hours/notes only, see deployment.validation.js's updateDeploymentSchema
 *  for exactly why the scope stops there. */
export async function updateDeployment(id, payload) {
  const { data } = await api.patch(`/deployments/${id}`, payload);
  return data.data;
}

/** Who's currently free — every 'Own' Worker-login employee with no current
 *  client, plus every subcontractor/freelancer worker whose most recent
 *  placement has ended with nothing newer since. See the server's own
 *  getStandbyWorkforce doc comment for why these are two different shapes. */
export async function getStandbyWorkforce() {
  const { data } = await api.get('/deployments/standby');
  return data.data; // { ownEmployees, subcontractedWorkers }
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
