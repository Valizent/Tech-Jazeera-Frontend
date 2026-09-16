/**
 * Reconciliation API layer — a standing, read-only integrity report.
 * Section-Access-gated on the server; this file just calls it.
 */
import { api } from '../../lib/axios.js';

/** GET /reconciliation — no params, always the full current report. */
export async function getReconciliationReport() {
  const { data } = await api.get('/reconciliation');
  return data.data; // { checkedAt, total, byCategory, findings }
}
