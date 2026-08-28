import { BaseModel } from './BaseModel';

/**
 * EmployeeModel
 * Encapsulates employee data, avatar resolution, name localization, and business rules.
 */
export class EmployeeModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.staffId = data.staffId || '';
    this.nameEn = data.nameEn || '';
    this.nameKh = data.nameKh || '';
    this.gender = data.gender || 'Male';
    this.branch = data.branch || '';
    this.status = data.status || 'Active';
    this.role = data.role || 'Employee';
    this.email = data.email || '';
    this.photoUrl = data.photoUrl || '';
    this.faceData = data.faceData || null;
    this.departmentId = data.departmentId || null;
    this.positionId = data.positionId || null;
    this.department = data.department || null;
    this.position = data.position || null;
    this.joinDate = data.joinDate ? new Date(data.joinDate) : null;
    this.shift1Start = data.shift1Start || '08:00';
    this.shift1End = data.shift1End || '12:00';
    this.shift2Start = data.shift2Start || '13:00';
    this.shift2End = data.shift2End || '17:00';
    this.isFlexible = Boolean(data.isFlexible);
    this.flexibleSchedule = typeof data.flexibleSchedule === 'string'
      ? data.flexibleSchedule
      : JSON.stringify(data.flexibleSchedule || {});
    this.address = data.address || '';
    this.idCardPassport = data.idCardPassport || '';
  }

  /**
   * Resolve photo URL with face recognition enrollment fallback
   * @returns {string}
   */
  getPhoto() {
    if (this.photoUrl) return this.photoUrl;
    if (Array.isArray(this.faceData) && this.faceData[0]?.photoUrl) return this.faceData[0].photoUrl;
    if (this.faceData?.photoUrl) return this.faceData.photoUrl;
    return '';
  }

  /**
   * Get localized name based on active language function
   * @param {Function} [localizeFn]
   * @returns {string}
   */
  getDisplayName(localizeFn) {
    if (typeof localizeFn === 'function') {
      return localizeFn(this.nameEn, this.nameKh) || this.staffId;
    }
    return this.nameEn || this.nameKh || this.staffId;
  }

  /**
   * Formatted ID and Role subtitle (e.g., "ID: EMP-001 • Admin")
   * @returns {string}
   */
  getIdSubtitle() {
    return this.role ? `ID: ${this.staffId} • ${this.role}` : `ID: ${this.staffId}`;
  }

  /**
   * Check if employee has active status
   * @returns {boolean}
   */
  isActive() {
    return this.status === 'Active';
  }

  /**
   * Check if employee has configured shift 2
   * @returns {boolean}
   */
  hasShift2() {
    return Boolean(this.shift2Start && this.shift2End);
  }

  /**
   * Factory method to create an array of models from API response
   * @param {Array} list
   * @returns {EmployeeModel[]}
   */
  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new EmployeeModel(item)) : [];
  }
}
