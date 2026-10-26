import { orderApi } from './client';

function unwrap(list) {
  return Array.isArray(list) ? list : (list?.content ?? list?.data ?? []);
}

export async function listNotifications() {
  return unwrap(await orderApi.get('/notifications'));
}
export async function getUnreadCount() {
  const r = await orderApi.get('/notifications/unread-count');
  return r?.count ?? 0;
}
export async function markNotificationRead(id) {
  return await orderApi.post(`/notifications/${id}/read`);
}
export async function markAllNotificationsRead() {
  return await orderApi.post('/notifications/read-all');
}
