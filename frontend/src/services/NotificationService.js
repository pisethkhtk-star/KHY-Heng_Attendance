import { BaseApiService } from './BaseApiService';

class NotificationService extends BaseApiService {
  constructor() {
    super('/notifications');
  }

  async getNotifications() {
    const response = await this.api.get(this.endpoint);
    return response.data || [];
  }

  async getUnreadCount() {
    const response = await this.api.get(`${this.endpoint}/unread-count`);
    return response.data?.unreadCount || 0;
  }

  async markAsRead(id) {
    const response = await this.api.put(`${this.endpoint}/${id}/read`);
    return response.data;
  }

  async markAllAsRead() {
    const response = await this.api.put(`${this.endpoint}/read-all`);
    return response.data;
  }

  async deleteNotification(id) {
    const response = await this.api.delete(`${this.endpoint}/${id}`);
    return response.data;
  }

  async clearAll() {
    const response = await this.api.delete(`${this.endpoint}/clear-all`);
    return response.data;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
