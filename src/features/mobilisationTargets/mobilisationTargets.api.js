/**
 * Mobilisation Targets API — coordinator targets and live progress.
 */
import { api } from '../../lib/axios.js';

/** Coordinator's own target + progress for a given month (YYYY-MM). */
export async function getMyTarget(month) {
  const { data } = await api.get('/mobilisation-targets/my', { params: { month } });
  return data.data; // null if no target set, or { target, achieved, remaining, hit, incentivePercent, month }
}

/** Management: all coordinators' progress for a given month. */
export async function getAllProgress(month) {
  const { data } = await api.get('/mobilisation-targets/progress', { params: { month } });
  return data.data; // [{ coordinator, target, achieved, remaining, hit, incentivePercent }]
}

/** Coordinator's own rolling 6-month progress, window ending at endMonth (YYYY-MM). */
export async function getMySemiAnnual(endMonth) {
  const { data } = await api.get('/mobilisation-targets/semi-annual/my', { params: { endMonth } });
  return data.data; // null, or { windowMonths, semiAnnualTarget, achieved, netProfit, excess, excessNetProfit, incentivePercent, incentiveAmount, hit }
}

export async function getMyMonthlyWindow(endMonth) {
  const { data } = await api.get('/mobilisation-targets/monthly-window/my', { params: { endMonth } });
  return data.data;
}

/** Management: every coordinator's rolling 6-month progress. */
export async function getAllSemiAnnual(endMonth) {
  const { data } = await api.get('/mobilisation-targets/semi-annual', { params: { endMonth } });
  return data.data; // { windowMonths, rows: [{ coordinator, ...same shape as above }] }
}

/** Management: every coordinator's 6-month monthly progress. */
export async function getAllMonthlyWindow(endMonth) {
  const { data } = await api.get('/mobilisation-targets/monthly-window', { params: { endMonth } });
  return data.data; // { windowMonths, rows: [...] }
}

/** Management: all targets across all months. */
export async function listAllTargets() {
  const { data } = await api.get('/mobilisation-targets');
  return data.data;
}

/** Upsert a target for a coordinator+month. */
export async function setTarget(payload) {
  // payload: { coordinatorId, month, target, incentivePercent }
  const { data } = await api.post('/mobilisation-targets', payload);
  return data.data;
}

/** Remove a target by id. */
export async function deleteTarget(id) {
  await api.delete(`/mobilisation-targets/${id}`);
}
