import { BaseApiService } from './BaseApiService';

class PushNotificationService extends BaseApiService {
  constructor() {
    super('/push-campaigns');
  }

  async getAllCampaigns() {
    const response = await this.api.get(this.endpoint);
    return response.data || [];
  }

  async getCampaignStats() {
    const response = await this.api.get(`${this.endpoint}/stats`);
    return response.data || { total: 0, pending: 0, sent: 0, cancelled: 0 };
  }

  async createCampaign(data) {
    const response = await this.api.post(this.endpoint, data);
    return response.data;
  }

  async cancelCampaign(id) {
    const response = await this.api.put(`${this.endpoint}/${id}/cancel`);
    return response.data;
  }

  async deleteCampaign(id) {
    const response = await this.api.delete(`${this.endpoint}/${id}`);
    return response.data;
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
