/**
 * Chat API layer. Messages are sent as multipart (optional text + optional image/PDF in `file`); an attachment
 * is fetched through the authenticated axios instance as a Blob, like Documents (a plain <img>/<a> cannot carry
 * the in-memory access token).
 */
import { api } from '../../lib/axios.js';

export async function listConversations() {
  const { data } = await api.get('/chat/conversations', { params: { limit: 100 } });
  return data.data.items;
}

/** The sidebar badge's own poll: one number. */
export async function getChatUnreadCount() {
  const { data } = await api.get('/chat/unread-count');
  return data.data.unreadCount;
}

/** Newest first. `before` is the previous page's `nextBefore`. */
export async function listChatMessages(conversationId, { before } = {}) {
  const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { before, limit: 30 } });
  return data.data; // { items, hasMore, nextBefore }
}

export async function sendChatMessage(conversationId, { body, file }) {
  const form = new FormData();
  if (body) form.append('body', body);
  if (file) form.append('file', file);
  const { data } = await api.post(`/chat/conversations/${conversationId}/messages`, form);
  return data.data;
}

export async function markChatRead(conversationId) {
  await api.post(`/chat/conversations/${conversationId}/read`);
}

export async function createConversation(payload) {
  const { data } = await api.post('/chat/conversations', payload);
  return data.data;
}

/** { name?, addMemberIds?, removeMemberIds? } - group admins only. */
export async function updateConversation(conversationId, payload) {
  const { data } = await api.patch(`/chat/conversations/${conversationId}`, payload);
  return data.data;
}

export async function leaveConversation(conversationId) {
  await api.delete(`/chat/conversations/${conversationId}/members/me`);
}

export async function deleteChatMessage(messageId) {
  await api.delete(`/chat/messages/${messageId}`);
}

export async function reportChatMessage(messageId, { reason }) {
  await api.post(`/chat/messages/${messageId}/report`, { reason });
}

export async function listChatDirectory() {
  const { data } = await api.get('/chat/directory');
  return data.data; // [{ id, name, role }]
}

export async function fetchChatFileBlob(messageId) {
  const res = await api.get(`/chat/messages/${messageId}/file`, { responseType: 'blob' });
  return res.data;
}

export async function listChatReports(params) {
  const { data } = await api.get('/chat/reports', { params });
  return data.data; // { items, total, page, pages }
}

export async function decideChatReport(reportId, action) {
  await api.patch(`/chat/reports/${reportId}`, { action });
}

export async function fetchReportFileBlob(reportId) {
  const res = await api.get(`/chat/reports/${reportId}/file`, { responseType: 'blob' });
  return res.data;
}
