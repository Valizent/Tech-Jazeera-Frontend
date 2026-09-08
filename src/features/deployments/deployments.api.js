/**
 * Deployments API layer — the only file that knows deployment endpoint URLs.
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

/** Assign a worker: POST /deployments { worker, client, site, ... } */
export async function assignWorker(payload) {
  const { data } = await api.post('/deployments', payload);
  return data.data;
}

/** Transfer the worker of a deployment: POST /deployments/:id/transfer */
export async function transferDeployment(id, payload) {
  const { data } = await api.post(`/deployments/${id}/transfer`, payload);
  return data.data;
}

/** End (unassign) a deployment: POST /deployments/:id/end */
export async function endDeployment(id) {
  await api.post(`/deployments/${id}/end`);
}

// TEMPORARY — pre-production cleanup only, Admin-only. Remove this function
// along with its call sites and the server route/service/controller behind
// it before going live.
export async function deleteDeployment(id) {
  await api.delete(`/deployments/${id}`);
}
