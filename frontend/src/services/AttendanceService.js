import { BaseApiService } from './BaseApiService';
import { AttendanceModel } from '../models/AttendanceModel';

/**
 * AttendanceService
 * Handles attendance logs, early-in/out, late arrivals, and live kiosk scans.
 */
class AttendanceService extends BaseApiService {
  constructor() {
    super('/attendances');
  }

  /**
   * Fetch attendance logs as AttendanceModel array
   * @param {Object} [params]
   * @returns {Promise<AttendanceModel[]>}
   */
  async getAttendanceLogs(params = {}) {
    const data = await this.getAll(params);
    return AttendanceModel.fromArray(data);
  }

  /**
   * Log attendance for employee
   * @param {Object} payload
   * @returns {Promise<any>}
   */
  async logAttendance(payload) {
    const response = await this.api.post(`${this.endpoint}/log`, payload);
    return response.data;
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
