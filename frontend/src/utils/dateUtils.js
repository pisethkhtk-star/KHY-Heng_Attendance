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
