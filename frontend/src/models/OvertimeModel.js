import { BaseModel } from './BaseModel';
import { EmployeeModel } from './EmployeeModel';

/**
 * OvertimeModel
 * Encapsulates overtime request records, hours & day fraction calculations.
 */
export class OvertimeModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.staffId = data.staffId || '';
    this.managerId = data.managerId || '';
    this.managerName = data.managerName || '';
    this.branch = data.branch || '';
    this.branchId = data.branchId || null;
    this.branchLocation = data.branchLocation || null;
    this.fromDate = data.fromDate ? new Date(data.fromDate) : null;
    this.toDate = data.toDate ? new Date(data.toDate) : null;
    this.startTime = data.startTime || '';
    this.endTime = data.endTime || '';
    this.amountDay = data.amountDay ? String(data.amountDay) : '0';
    this.reason = data.reason || '';
    this.status = data.status || 'Pending';
    this.comment = data.comment || '';
    this.requestedAt = data.requestedAt ? new Date(data.requestedAt) : null;
    this.approvedAt = data.approvedAt ? new Date(data.approvedAt) : null;
    this.createdBy = data.createdBy || '';
    this.employee = data.employee ? new EmployeeModel(data.employee) : null;
    this.manager = data.manager ? new EmployeeModel(data.manager) : null;
  }

  /**
   * Check if overtime is pending
   * @returns {boolean}
   */
  isPending() {
    return this.status === 'Pending';
  }

  /**
   * Check if overtime is approved
   * @returns {boolean}
   */
  isApproved() {
    return this.status === 'Approved';
  }

  /**
   * Status badge styling class
   * @returns {string}
   */
  getStatusBadgeClass() {
    switch (this.status) {
      case 'Approved':
        return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20';
      case 'Rejected':
        return 'bg-rose-500/10 text-rose-300 ring-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-300 ring-amber-500/20';
    }
  }

  /**
   * Factory method to create an array of models from API response
   * @param {Array} list
   * @returns {OvertimeModel[]}
   */
  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new OvertimeModel(item)) : [];
  }
}
