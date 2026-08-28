import { BaseModel } from './BaseModel';

/**
 * PositionModel
 */
export class PositionModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.titleEn = data.titleEn || '';
    this.titleKh = data.titleKh || '';
    this.departmentId = data.departmentId || null;
    this.department = data.department || null;
  }

  getDisplayTitle(localizeFn) {
    if (typeof localizeFn === 'function') {
      return localizeFn(this.titleEn, this.titleKh) || this.titleEn;
    }
    return this.titleEn || this.titleKh;
  }

  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new PositionModel(item)) : [];
  }
}
