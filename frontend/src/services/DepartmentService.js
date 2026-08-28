import { BaseApiService } from './BaseApiService';
import { DepartmentModel } from '../models/DepartmentModel';

/**
 * DepartmentService
 */
class DepartmentService extends BaseApiService {
  constructor() {
    super('/departments');
  }

  async getDepartments(params = {}) {
    const data = await this.getAll(params);
    return DepartmentModel.fromArray(data);
  }
}

export const departmentService = new DepartmentService();
export default departmentService;
