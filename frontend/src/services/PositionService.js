import { BaseApiService } from './BaseApiService';
import { PositionModel } from '../models/PositionModel';

/**
 * PositionService
 */
class PositionService extends BaseApiService {
  constructor() {
    super('/positions');
  }

  async getPositions(params = {}) {
    const data = await this.getAll(params);
    return PositionModel.fromArray(data);
  }
}

export const positionService = new PositionService();
export default positionService;
