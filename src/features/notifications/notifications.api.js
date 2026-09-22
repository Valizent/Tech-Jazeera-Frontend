/**
 * Notifications API layer (P3-F) — the in-app list plus the Web Push
 * subscribe/unsubscribe calls. Available to every authenticated role
 * (Worker included) — see notification.routes.js.
 */
import { api } from '../../lib/axios.js';

export async function listNotifications(params) {
  const { data } = await api.get('/notifications', { params });
  return data.data; // { items, total, page, pages, unreadCount }
}

/** The bell badge's own lightweight poll — one number, not the full list. */
export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.data.unreadCount;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data.data;
}

export async function getVapidPublicKey() {
  const { data } = await api.get('/notifications/vapid-public-key');
  return data.data.publicKey;
}

export async function subscribeToPush(subscription) {
  await api.post('/notifications/subscribe', { ...subscription, userAgent: navigator.userAgent });
}

export async function unsubscribeFromPush(endpoint) {
  await api.post('/notifications/unsubscribe', { endpoint });
}
