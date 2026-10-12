/**
 * Subcontractor transfers API layer - the only file that knows these URLs.
 */
import { api } from '../../lib/axios.js';

/** GET /subcontractor-transfers?status= -> { canDecide, items } (non-deciders get only their own). */
export async function listTransfers(params) {
  const { data } = await api.get('/subcontractor-transfers', { params });
  return data.data;
}

/** PATCH /subcontractor-transfers/:id/decide { decision: 'Approved'|'Rejected', decisionNote? } */
export async function decideTransfer(id, payload) {
  const { data } = await api.patch(`/subcontractor-transfers/${id}/decide`, payload);
  return data.data;
}
