/**
 * Dashboard API layer — one call for the whole overview.
 */
import { api } from '../../lib/axios.js';

/**
 * thresholdDays (P2-M2): override the 30-day expiry-alert window.
 * month (P2-M8): "YYYY-MM" — the period the real-profit section shows;
 * omit for the current calendar month.
 */
export async function getDashboard(thresholdDays, month) {
  const params = {};
  if (thresholdDays) params.thresholdDays = thresholdDays;
  if (month) params.month = month;
  const { data } = await api.get('/dashboard', { params: Object.keys(params).length ? params : undefined });
  return data.data;
}

export async function getStandbyAnalysis() {
  const { data } = await api.get('/dashboard/standby-analysis');
  return data.data;
}

/** month: "YYYY-MM", omit for the current calendar month — same shape as
 *  getCoordinatorLeaderboard's own, so the two can be called with the exact
 *  same value and never disagree on which month "this month's profit" means. */
export async function getCoordinatorDrillDown(id, month) {
  const { data } = await api.get(`/dashboard/coordinator-drill-down/${id}`, { params: month ? { month } : undefined });
  return data.data;
}

/** month: "YYYY-MM", omit for the current calendar month. */
export async function getCoordinatorLeaderboard(month) {
  const { data } = await api.get('/dashboard/coordinator-leaderboard', { params: month ? { month } : undefined });
  return data.data;
}
