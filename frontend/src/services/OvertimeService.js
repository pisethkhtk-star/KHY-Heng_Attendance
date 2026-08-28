import { BaseApiService } from './BaseApiService';
import { OvertimeModel } from '../models/OvertimeModel';

/**
 * OvertimeService
 * Handles overtime requests, approvals, and overtime calculations.
 */
class OvertimeService extends BaseApiService {
  constructor() {
    super('/overtimes');
  }

  /**
   * Fetch overtime list as OvertimeModel array
   * @param {Object} [params]
   * @returns {Promise<OvertimeModel[]>}
   */
  async getOvertimes(params = {}) {
    const data = await this.getAll(params);
    return OvertimeModel.fromArray(data);
  }

  /**
   * Update overtime decision
   * @param {string} id
   * @param {string} status
   * @param {string} comment
   * @param {string} managerName
   * @returns {Promise<any>}
   */
  async updateStatus(id, status, comment, managerName) {
    const response = await this.api.put(`${this.endpoint}/${id}/status`, { status, comment, managerName });
    return response.data;
  }
}

export const overtimeService = new OvertimeService();
export default overtimeService;
