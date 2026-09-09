/**
 * Company settings API layer. Every route here is gated server-side by
 * Section Access's dynamic 'companySettings' check — a 403 here means the
 * viewer just isn't eligible (not granted on the Section Access page), not
 * that something's broken.
 */
import { api } from '../../lib/axios.js';

export async function getCompanySettings() {
  const { data } = await api.get('/company-settings');
  return data.data;
}

// Public endpoint (no Section Access gate) — see the server route's own
// doc comment. Used by BrandLogo.jsx for the app shell's logo/name,
// including the pre-login screen and the ESS portal.
export async function getCompanyBranding() {
  const { data } = await api.get('/company-settings/branding');
  return data.data;
}

export async function updateCompanySettings(payload) {
  const { data } = await api.patch('/company-settings', payload);
  return data.data;
}

export async function uploadCompanyLogo(file) {
  const fd = new FormData();
  fd.append('logo', file);
  const { data } = await api.post('/company-settings/logo', fd);
  return data.data;
}

export async function removeCompanyLogo() {
  const { data } = await api.delete('/company-settings/logo');
  return data.data;
}
