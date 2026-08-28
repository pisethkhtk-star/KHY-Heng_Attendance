import { BaseApiService } from './BaseApiService';
import { EmployeeModel } from '../models/EmployeeModel';

/**
 * EmployeeService
 * Handles all employee management API requests, facial data enrollment, and seeding.
 */
class EmployeeService extends BaseApiService {
  constructor() {
    super('/employees');
  }

  /**
   * Fetch all employees and return EmployeeModel array
   * @param {Object} [params]
   * @returns {Promise<EmployeeModel[]>}
   */
  async getEmployees(params = {}) {
    const data = await this.getAll(params);
    return EmployeeModel.fromArray(data);
  }

  /**
   * Fetch single employee model
   * @param {string} id
   * @returns {Promise<EmployeeModel>}
   */
  async getEmployee(id) {
    const data = await this.getById(id);
    return new EmployeeModel(data);
  }

  /**
   * Seed 12 standard employees into database
   * @returns {Promise<any>}
   */
  async seed12Employees() {
    const response = await this.api.post(`${this.endpoint}/seed-12`);
    return response.data;
  }
}

export const employeeService = new EmployeeService();
export default employeeService;
