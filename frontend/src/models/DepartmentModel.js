import { BaseModel } from './BaseModel';

/**
 * DepartmentModel
 */
export class DepartmentModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.nameEn = data.nameEn || '';
    this.nameKh = data.nameKh || '';
    this.description = data.description || '';
  }

  getDisplayName(localizeFn) {
    if (typeof localizeFn === 'function') {
      return localizeFn(this.nameEn, this.nameKh) || this.nameEn;
    }
    return this.nameEn || this.nameKh;
  }

  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new DepartmentModel(item)) : [];
  }
}
