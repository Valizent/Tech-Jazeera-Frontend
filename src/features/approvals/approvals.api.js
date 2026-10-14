/**
 * Approvals API layer — Admin-only configuration of ApprovalRoles and
 * ApprovalWorkflows. Deciding a step happens on each request module's own
 * decide endpoint instead (leave.api.js etc.).
 */
import { api } from '../../lib/axios.js';

export async function listApprovalRoles() {
  const { data } = await api.get('/approvals/roles');
  return data.data;
}

export async function createApprovalRole(payload) {
  const { data } = await api.post('/approvals/roles', payload);
  return data.data;
}

export async function updateApprovalRole(id, payload) {
  const { data } = await api.patch(`/approvals/roles/${id}`, payload);
  return data.data;
}

export async function listApprovalWorkflows() {
  const { data } = await api.get('/approvals/workflows');
  return data.data;
}

export async function createApprovalWorkflow(payload) {
  const { data } = await api.post('/approvals/workflows', payload);
  return data.data;
}

export async function updateApprovalWorkflow(id, payload) {
  const { data } = await api.patch(`/approvals/workflows/${id}`, payload);
  return data.data;
}

/** Each employee's own hierarchy per module (default unless changed). */
export async function listEmployeeApprovals(params) {
  const { data } = await api.get('/approvals/employees', { params });
  return data.data;
}

/** workflow: an approval hierarchy id, or null to put the module back on the default. */
export async function setEmployeeApprovalOverride(employeeId, payload) {
  const { data } = await api.put(`/approvals/employees/${employeeId}/override`, payload);
  return data.data;
}

/** Cross-request-type approval log — visible to Admin or any real
 *  ApprovalRole member (the server enforces this dynamically; a non-member
 *  gets a 403 with a clear message). */
export async function listApprovalLog(params) {
  const { data } = await api.get('/approvals/log', { params });
  return data.data;
}
