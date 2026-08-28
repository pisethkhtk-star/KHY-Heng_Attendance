import { BaseModel } from './BaseModel';
import { EmployeeModel } from './EmployeeModel';

/**
 * AttendanceModel
 * Encapsulates attendance log records, timestamp conversions, and status computations.
 */
export class AttendanceModel extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.staffId = data.staffId || '';
    this.attendanceDate = data.attendanceDate ? new Date(data.attendanceDate) : null;
    this.checkin1 = data.checkin1 || null;
    this.checkout1 = data.checkout1 || null;
    this.checkin2 = data.checkin2 || null;
    this.checkout2 = data.checkout2 || null;
    this.isLate = Boolean(data.isLate);
    this.isEarlyLeave = Boolean(data.isEarlyLeave);
    this.earlyInMinutes = Number(data.earlyInMinutes) || 0;
    this.lateMinutes = Number(data.lateMinutes) || 0;
    this.earlyOutMinutes = Number(data.earlyOutMinutes) || 0;
    this.note = data.note || '';
    this.employee = data.employee ? new EmployeeModel(data.employee) : null;
  }

  /**
   * Convert time string (e.g., "17:30:00") to 12-hour format ("05:30 PM")
   * @param {string|null} timeStr
   * @returns {string}
   */
  static formatTime12Hour(timeStr) {
    if (!timeStr) return '-';
    try {
      const parts = timeStr.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      const hStr = h < 10 ? `0${h}` : `${h}`;
      return `${hStr}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  }

  /**
   * Formatted check-in 1
   */
  get formattedCheckin1() {
    return AttendanceModel.formatTime12Hour(this.checkin1);
  }

  /**
   * Formatted check-out 1
   */
  get formattedCheckout1() {
    return AttendanceModel.formatTime12Hour(this.checkout1);
  }

  /**
   * Formatted check-in 2
   */
  get formattedCheckin2() {
    return AttendanceModel.formatTime12Hour(this.checkin2);
  }

  /**
   * Formatted check-out 2
   */
  get formattedCheckout2() {
    return AttendanceModel.formatTime12Hour(this.checkout2);
  }

  /**
   * Formatted date string (YYYY-MM-DD)
   */
  get formattedDate() {
    if (!this.attendanceDate) return '-';
    return this.attendanceDate.toISOString().split('T')[0];
  }

  /**
   * Factory method to create an array of models from API response
   * @param {Array} list
   * @returns {AttendanceModel[]}
   */
  static fromArray(list = []) {
    return Array.isArray(list) ? list.map(item => new AttendanceModel(item)) : [];
  }
}
