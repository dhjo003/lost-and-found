import axios from 'axios';

const api = axios.create({
  baseURL: '/', // adjust if API is on different origin
});

// attach JWT for requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('app_jwt');
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

// Messages
export async function fetchConversationHistory(otherUserId, page = 1, pageSize = 100) {
  const res = await api.get(`/api/messages/history/${otherUserId}`, { params: { page, pageSize } });
  return res.data;
}

export async function sendMessage(receiverId, content) {
  const res = await api.post('/api/messages/send', { receiverId, content });
  return res.data;
}

export async function markMessageRead(messageId) {
  return api.post(`/api/messages/${messageId}/mark-read`);
}

export async function softDeleteMessage(messageId) {
  return api.post(`/api/messages/${messageId}/soft-delete`);
}

// Users
export async function fetchUser(userId) {
  const res = await api.get(`/api/users/${userId}`);
  return res.data;
}

// Notifications
export async function fetchNotifications(page = 1, pageSize = 50) {
  const res = await api.get('/api/notifications', { params: { page, pageSize } });
  return res.data;
}

export async function deleteNotification(notificationId) {
  return api.delete(`/api/notifications/${notificationId}`);
}

export async function markNotificationRead(notificationId) {
  return api.post(`/api/notifications/${notificationId}/mark-read`);
}

export async function markAllNotificationsRead() {
  return api.post('/api/notifications/mark-all-read');
}

export async function getUnreadMessageCount() {
  const res = await api.get('/api/messages/unread-count');
  return res.data; // { Unread: n }
}

export async function deleteConversation(otherUserId) {
  return api.post(`/api/messages/conversations/${otherUserId}/delete`);
}

export async function fetchConversationSummaries() {
  const res = await api.get('/api/messages/conversations');
  return res.data; // array of ConversationListItemDto
}

export default api;