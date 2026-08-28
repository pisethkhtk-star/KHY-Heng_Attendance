import { BaseApiService } from './BaseApiService';
import { LeaveModel } from '../models/LeaveModel';

/**
 * LeaveService
 * Handles leave requests, approvals, types, allowances, and approval rules.
 */
class LeaveService extends BaseApiService {
  constructor() {
    super('/leaves');
  }

  /**
   * Fetch leave requests as LeaveModel array
   * @param {Object} [params]
   * @returns {Promise<LeaveModel[]>}
   */
  async getLeaves(params = {}) {
    const data = await this.getAll(params);
    return LeaveModel.fromArray(data);
  }

  /**
   * Update leave request decision (Approved / Rejected)
   * @param {string} id
   * @param {string} status
   * @param {string} managerName
   * @returns {Promise<any>}
   */
  async updateStatus(id, status, managerName) {
    const response = await this.api.put(`${this.endpoint}/${id}/status`, { status, managerName });
    return response.data;
  }

  /**
   * Fetch leave types
   * @returns {Promise<any[]>}
   */
  async getLeaveTypes() {
    const response = await this.api.get('/leave-types');
    return response.data;
  }

  /**
   * Fetch employee leave allowances/limits
   * @returns {Promise<any[]>}
   */
  async getLeaveAllowances() {
    const response = await this.api.get('/employee-leave-limits');
    return response.data;
  }

  /**
   * Fetch approval management rules
   * @returns {Promise<any[]>}
   */
  async getApprovalRules() {
    const response = await this.api.get('/leave-approvals');
    return response.data;
  }
}

export const leaveService = new LeaveService();
export default leaveService;
