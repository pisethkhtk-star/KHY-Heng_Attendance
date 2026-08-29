/**
 * Utility function to format 24-hour time strings (HH:mm:ss or HH:mm) into 12-hour format with AM/PM
 * @param {string} timeStr - Time string in 24-hour format
 * @returns {string} - Formatted time in 12-hour AM/PM format
 */
export const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];

  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${ampm}`;
};

/**
 * Utility function to format any date string or Date object into DD/MM/YYYY
 * @param {string|Date} dateVal - Date string or Date object
 * @returns {string} - Formatted date in DD/MM/YYYY format (e.g. "29/08/2026")
 */
export const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '-';
  try {
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      const datePart = clean.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        return `${d}/${m}/${y}`;
      }
    }
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
};

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTHS_KH = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

/**
 * Utility function to format any date string or Date object into DD MMMM YYYY (e.g. "01 August 2026")
 * @param {string|Date} dateVal - Date string or Date object
 * @param {string} locale - 'en' or 'kh' (defaults to 'en')
 * @returns {string} - Formatted date in DD MMMM YYYY format (e.g. "28 August 2026")
 */
export const formatDateWithMonth = (dateVal, locale = 'en') => {
  if (!dateVal) return '-';
  try {
    let day = '';
    let monthIndex = -1;
    let year = '';

    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      const datePart = clean.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        year = y;
        monthIndex = parseInt(m, 10) - 1;
        day = String(parseInt(d, 10)).padStart(2, '0');
      }
    }

    if (monthIndex < 0 || monthIndex > 11) {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      day = String(d.getDate()).padStart(2, '0');
      monthIndex = d.getMonth();
      year = String(d.getFullYear());
    }

    const monthName = (locale === 'kh') ? MONTHS_KH[monthIndex] : MONTHS_EN[monthIndex];
    return `${day} ${monthName} ${year}`;
  } catch {
    return String(dateVal);
  }
};
