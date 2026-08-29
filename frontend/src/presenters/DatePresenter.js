/**
 * DatePresenter
 * OOP presenter for date, time conversions, formatting and date arithmetic.
 */
export class DatePresenter {
  /**
   * Format date to YYYY-MM-DD
   * @param {Date|string|null} date
   * @returns {string}
   */
  static toYmd(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  /**
   * Format date to DD/MM/YYYY
   * @param {Date|string|null} date
   * @returns {string}
   */
  static toDDMMYYYY(date) {
    if (!date) return '-';
    try {
      if (typeof date === 'string') {
        const clean = date.trim();
        const datePart = clean.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [y, m, d] = datePart.split('-');
          return `${d}/${m}/${y}`;
        }
      }
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return String(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(date);
    }
  }

  /**
   * Format date for localized display in DD/MM/YYYY
   * @param {Date|string|null} date
   * @returns {string}
   */
  static toDisplay(date) {
    return DatePresenter.toDDMMYYYY(date);
  }

  /**
   * Convert 24-hour time to 12-hour time (e.g., "17:30" -> "05:30 PM")
   * @param {string|null} timeStr
   * @returns {string}
   */
  static to12Hour(timeStr) {
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
}

export default DatePresenter;
