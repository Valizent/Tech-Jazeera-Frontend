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

/** `formData` must include invoiceNumber, invoiceDate, and a `file` (the
 *  invoice PDF copy) — see DeploymentDetailPage.jsx's FormData-building
 *  pattern (mirrors MyRequestsPage.jsx's reimbursement submit). */
export async function sendInvoice(id, entryId, formData) {
  const { data } = await api.post(`/deployments/${id}/monthly-hours/${entryId}/send-invoice`, formData);
  return data.data;
}

/** Download a month's uploaded invoice copy as an authenticated Blob, named
 *  by its original filename — same pattern as reimbursements.api.js's
 *  downloadReceipt. */
export async function downloadInvoiceFile(id, entryId, filename) {
  const res = await api.get(`/deployments/${id}/monthly-hours/${entryId}/invoice-file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Every CLIENT with at least one outstanding invoice, own or company-wide
 *  depending on the viewer (2026-09-27 bulk-payment redesign — a client
 *  pays in bulk for everyone placed there, never per worker; see
 *  deployment.service.js's getClientsPaymentSummary). */
export async function getPaymentsDue() {
  const { data } = await api.get('/deployments/payments-due');
  return data.data;
}

/** One client's full billing picture — every invoice (paid or not) plus
 *  their real payment history — for the Payments Due page's drill-down. */
export async function getClientPaymentDetail(clientId) {
  const { data } = await api.get(`/deployments/payments-due/${clientId}`);
  return data.data;
}

/** Record one bulk payment this client made. `payload: { amount }`. */
export async function recordClientPayment(clientId, payload) {
  const { data } = await api.post(`/deployments/payments-due/${clientId}/payments`, payload);
  return data.data;
}

/** Approve/Reject a Pending recorded client payment. `payload: { decision, note }`. */
export async function decideClientPayment(paymentId, payload) {
  const { data } = await api.patch(`/deployments/client-payments/${paymentId}/decide`, payload);
  return data.data;
}

/** Every Approved-but-not-yet-invoiced month — the Clerk's own queue (see
 *  deployment.service.js's getReadyToInvoice). */
export async function getReadyToInvoice() {
  const { data } = await api.get('/deployments/ready-to-invoice');
  return data.data;
}

/** All Pending monthly-hours entries across all deployments — the manager's
 *  approval queue (requires deploymentsHoursDecide write access). */
export async function getPendingHoursQueue() {
  const { data } = await api.get('/deployments/pending-hours');
  return data.data;
}

/** Demobilise — ends this deployment. `payload.reason` decides whether the
 *  worker goes back to standby or exits the company (see deployments.schema.js). */
export async function demobiliseDeployment(id, payload) {
  const { data } = await api.post(`/deployments/${id}/demobilise`, payload);
  return data.data;
}
