/**
 * ESS ("me") API layer — the self-service surface a Worker sees. Every call
 * hits /api/me/*, which resolves against the server's req.user.employee —
 * there is never an id in these URLs the client could tamper with.
 */
import { api } from '../../lib/axios.js';

export async function getMyProfile() {
  const { data } = await api.get('/me');
  return data.data;
}

/** Self-edit (Milestone 4) — contact-info fields only. `payload` matches
 *  profile.schema.js's updateMyProfileFormSchema shape. */
export async function updateMyProfile(payload) {
  const { data } = await api.patch('/me', payload);
  return data.data;
}

export async function listMyDocuments(params) {
  const { data } = await api.get('/me/documents', { params });
  return data.data; // { items, total, page, pages }
}

/** Fetch a document's file as a Blob (auth header can't ride a plain <a> link). */
export async function getMyDocumentFileBlob(id, version) {
  const { data } = await api.get(`/me/documents/${id}/file`, {
    params: version ? { version } : undefined,
    responseType: 'blob',
  });
  return data;
}

/** Fetch and save a file with its original name — same pattern as documents.api.js. */
export async function downloadMyDocumentFile(id, version, filename) {
  const blob = await getMyDocumentFileBlob(id, version);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function listMyLeave(params) {
  const { data } = await api.get('/me/leave', { params });
  return data.data;
}

/** `payload` is a FormData (see MyLeavePage's FormData-building pattern) —
 *  the attachment field is optional, unlike a reimbursement receipt. */
export async function submitMyLeave(payload) {
  const { data } = await api.post('/me/leave', payload);
  return data.data;
}

export async function cancelMyLeave(id) {
  const { data } = await api.patch(`/me/leave/${id}/cancel`);
  return data.data;
}

/** Download own leave attachment as an authenticated Blob, named by its original filename. */
export async function downloadMyLeaveAttachment(id, filename) {
  const res = await api.get(`/me/leave/${id}/attachment`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** POST /me/attendance/punch { lat?, lng?, accuracy? } — geofence/office-IP verified server-side. First
 *  punch of the day checks in; every punch after that pushes checkOutTime forward and recomputes hours. */
export async function punchMyAttendance(payload) {
  const { data } = await api.post('/me/attendance/punch', payload);
  return data.data; // { action: 'checked-in'|'checked-out', record }
}

export async function listMyAttendance(params) {
  const { data } = await api.get('/me/attendance', { params });
  return data.data;
}

export async function listMyAdvances(params) {
  const { data } = await api.get('/me/advances', { params });
  return data.data;
}

export async function submitMyAdvance(payload) {
  const { data } = await api.post('/me/advances', payload);
  return data.data;
}

export async function cancelMyAdvance(id) {
  const { data } = await api.patch(`/me/advances/${id}/cancel`);
  return data.data;
}

export async function listMyReimbursements(params) {
  const { data } = await api.get('/me/reimbursements', { params });
  return data.data;
}

/** multipart: fields + a `file` (the receipt image/PDF). */
export async function submitMyReimbursement(formData) {
  const { data } = await api.post('/me/reimbursements', formData);
  return data.data;
}

export async function cancelMyReimbursement(id) {
  const { data } = await api.patch(`/me/reimbursements/${id}/cancel`);
  return data.data;
}

/** Download own receipt as an authenticated Blob, named by its original filename. */
export async function downloadMyReceipt(id, filename) {
  const res = await api.get(`/me/reimbursements/${id}/receipt`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function listMyExitReentry(params) {
  const { data } = await api.get('/me/exit-reentry', { params });
  return data.data;
}

export async function submitMyExitReentry(payload) {
  const { data } = await api.post('/me/exit-reentry', payload);
  return data.data;
}

export async function cancelMyExitReentry(id) {
  const { data } = await api.patch(`/me/exit-reentry/${id}/cancel`);
  return data.data;
}

export async function listMyCertificates(params) {
  const { data } = await api.get('/me/certificates', { params });
  return data.data;
}

export async function submitMyCertificate(payload) {
  const { data } = await api.post('/me/certificates', payload);
  return data.data;
}

export async function cancelMyCertificate(id) {
  const { data } = await api.patch(`/me/certificates/${id}/cancel`);
  return data.data;
}

/** Download own certificate PDF as an authenticated Blob (letter types only). */
export async function downloadMyCertificatePdf(id, filename) {
  const res = await api.get(`/me/certificates/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Read-only — a Worker never assigns/returns their own assets. */
export async function listMyAssets() {
  const { data } = await api.get('/me/assets');
  return data.data;
}

export async function listMyTimesheets(params) {
  const { data } = await api.get('/me/timesheets', { params });
  return data.data;
}

/** { periodStart, notes? } — periodStart is any date within the target week. */
export async function submitMyTimesheet(payload) {
  const { data } = await api.post('/me/timesheets', payload);
  return data.data;
}

export async function listMyPayslips() {
  const { data } = await api.get('/me/payslips');
  return data.data;
}

/** Download own payslip PDF as an authenticated Blob. */
export async function downloadMyPayslipPdf(runId, filename) {
  const res = await api.get(`/me/payslips/${runId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
