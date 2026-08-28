import { BaseModel } from './BaseModel';
import { EmployeeModel } from './EmployeeModel';

/**
 * LeaveModel
 * Encapsulates leave requests, duration info, status badges, and employee context.
 */
export class LeaveModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.staffId = data.staffId || '';
    this.leaveType = data.leaveType || '';
    this.leaveDate = data.leaveDate ? new Date(data.leaveDate) : null;
    this.startDate = data.startDate ? new Date(data.startDate) : (this.leaveDate || null);
    this.endDate = data.endDate ? new Date(data.endDate) : (this.leaveDate || null);
    this.duration = data.duration || 'Full';
    this.amountDays = Number(data.amountDays) || 1;
    this.reason = data.reason || '';
    this.status = data.status || 'Pending';
    this.managerName = data.managerName || '';
    this.createdBy = data.createdBy || '';
    this.attachmentUrl = data.attachmentUrl || '';
    this.employee = data.employee ? new EmployeeModel(data.employee) : null;
  }

  /**
   * Check if leave is currently pending
   * @returns {boolean}
   */
  isPending() {
    return this.status === 'Pending';
  }

  /**
   * Check if leave has been approved
   * @returns {boolean}
   */
  isApproved() {
    return this.status === 'Approved';
  }

  /**
   * Get Tailwind CSS ring and badge class for status display
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
   * @returns {LeaveModel[]}
   */
  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new LeaveModel(item)) : [];
  }
}
