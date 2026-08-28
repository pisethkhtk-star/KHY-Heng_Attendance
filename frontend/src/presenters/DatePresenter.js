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
   * Format date for localized display
   * @param {Date|string|null} date
   * @param {string} [locale='en-US']
   * @returns {string}
   */
  static toDisplay(date, locale = 'en-US') {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
