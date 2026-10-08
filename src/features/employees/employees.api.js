/**
 * Employees API layer — the only file that knows employee endpoint URLs.
 */
import { api } from '../../lib/axios.js';

/** GET /employees — params: page, limit, search, status, type, alerts, sortBy, sortOrder */
export async function listEmployees(params) {
  const { data } = await api.get('/employees', { params });
  return data.data; // { items, total, page, pages }
}

/**
 * Every employee matching `params`, fetched a page at a time. The server caps one
 * page at 100, and a picker must offer everyone — a plain `limit: 100` quietly
 * left out whoever sorted after the hundredth. Same `{ items, total, page, pages }` shape.
 */
export async function listAllEmployees(params = {}) {
  const first = await listEmployees({ ...params, limit: 100, page: 1 });
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) => listEmployees({ ...params, limit: 100, page: i + 2 })));
  return { ...first, items: [first, ...rest].flatMap((p) => p.items) };
}

export async function getEmployee(id) {
  const { data } = await api.get(`/employees/${id}`);
  return data.data;
}

export async function createEmployee(payload) {
  const { data } = await api.post('/employees', payload);
  return data.data;
}

export async function updateEmployee(id, payload) {
  const { data } = await api.patch(`/employees/${id}`, payload);
  return data.data;
}

export async function deleteEmployee(id) {
  await api.delete(`/employees/${id}`);
}

/**
 * POST /employees/:id/user — provision a login for this employee, any role
 * except Admin (Admin/HR only). Returns { user, tempPassword }; the temp
 * password is shown ONCE. `payload.email` is optional — only needed when the
 * employee has no email on file. `payload.role` is required.
 */
export async function createEmployeeLogin(id, payload = {}) {
  const { data } = await api.post(`/employees/${id}/user`, payload);
  return data.data;
}

/** POST /employees/:id/user/reset-password — returns { tempPassword }, shown once. */
export async function resetEmployeeLoginPassword(id) {
  const { data } = await api.post(`/employees/${id}/user/reset-password`);
  return data.data;
}

/** PATCH /employees/:id/user/role — corrects an existing login's role.
 *  Revokes its sessions server-side, so the employee needs to sign in again. */
export async function updateEmployeeLoginRole(id, role) {
  const { data } = await api.patch(`/employees/${id}/user/role`, { role });
  return data.data;
}
