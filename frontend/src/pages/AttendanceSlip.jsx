import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  PrinterIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  UserGroupIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  Cog6ToothIcon,
  PhotoIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  XMarkIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import khyhengLogoDefault from '../assets/khyheng_logo.png';
import chandaraSignatureDefault from '../assets/chandara_signature.png';
import { formatTime12Hour, formatDateDDMMYYYY } from '../utils/dateUtils';

const SETTINGS_STORAGE_KEY = 'attendance_slip_custom_config_v2';

// Helper: convert HH:mm or HH:mm:ss to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '-' || timeStr === '--:--') return null;
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// Helper: convert minutes to H:MM:SS format (e.g. 42 mins -> "0:42:00", 248 mins -> "4:08:00")
const formatDurationHHMMSS = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0:00:00';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Helper: Format English full date "02 September 2026"
const formatEnglishFullDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Helper: Format Short date "1-Aug-2026"
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const AttendanceSlip = () => {
  const { language, t, getLocalizedName, locale } = useLanguage();
  const { user } = useAuth();

  // Data States
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [logs, setLogs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [overtimes, setOvertimes] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [companyWorkHours, setCompanyWorkHours] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('ALL'); // 'ALL' or specific staffId
  const [searchTerm, setSearchTerm] = useState('');
  const [printingSingleStaffId, setPrintingSingleStaffId] = useState(null); // specific staffId when printing 1 slip

  // Customization & Design Settings (Loaded from localStorage)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('signature'); // 'signature' | 'header' | 'display'

  const [projectName, setProjectName] = useState('Project: KH-KBC');
  const [projectTitleKh, setProjectTitleKh] = useState('គម្រោង បុរីកំបូល ស៊ីធី');
  const [reportTitleEn, setReportTitleEn] = useState('Checkin Late Report');

  // Signatures & Signer Info
  const [preparedByName, setPreparedByName] = useState('ឌី ច័ន្ទតារា');
  const [preparedDate, setPreparedDate] = useState(() => {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  });
  const [preparedSignatureUrl, setPreparedSignatureUrl] = useState(''); // base64 or empty for default
  const [showPreparedSignature, setShowPreparedSignature] = useState(true);

  const [approvedByName, setApprovedByName] = useState('');
  const [approvedDate, setApprovedDate] = useState('...../...../ 2026');
  const [approvedSignatureUrl, setApprovedSignatureUrl] = useState(''); // base64 or empty
  const [showApprovedSignature, setShowApprovedSignature] = useState(true);

  // Logo
  const [customLogoUrl, setCustomLogoUrl] = useState(''); // base64 or empty for default
  const [showLogo, setShowLogo] = useState(true);

  // Display toggles
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(true);

  // Hidden file input refs
  const preparedSignatureInputRef = useRef(null);
  const approvedSignatureInputRef = useRef(null);
  const logoInputRef = useRef(null);

  // Pagination for Slip preview
  const [currentPage, setCurrentPage] = useState(1);
  const slipsPerPage = 5;

  // Printable container ref
  const printAreaRef = useRef(null);

  // Load custom settings on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projectName !== undefined) setProjectName(parsed.projectName);
        if (parsed.projectTitleKh !== undefined) setProjectTitleKh(parsed.projectTitleKh);
        if (parsed.reportTitleEn !== undefined) setReportTitleEn(parsed.reportTitleEn);
        if (parsed.preparedByName !== undefined) setPreparedByName(parsed.preparedByName);
        if (parsed.preparedDate !== undefined) setPreparedDate(parsed.preparedDate);
        if (parsed.preparedSignatureUrl !== undefined) setPreparedSignatureUrl(parsed.preparedSignatureUrl);
        if (parsed.showPreparedSignature !== undefined) setShowPreparedSignature(parsed.showPreparedSignature);
        if (parsed.approvedByName !== undefined) setApprovedByName(parsed.approvedByName);
        if (parsed.approvedDate !== undefined) setApprovedDate(parsed.approvedDate);
        if (parsed.approvedSignatureUrl !== undefined) setApprovedSignatureUrl(parsed.approvedSignatureUrl);
        if (parsed.showApprovedSignature !== undefined) setShowApprovedSignature(parsed.showApprovedSignature);
        if (parsed.customLogoUrl !== undefined) setCustomLogoUrl(parsed.customLogoUrl);
        if (parsed.showLogo !== undefined) setShowLogo(parsed.showLogo);
        if (parsed.showDetailedBreakdown !== undefined) setShowDetailedBreakdown(parsed.showDetailedBreakdown);
      }
    } catch (e) {
      console.warn('Error reading slip settings from localStorage:', e);
    }
  }, []);

  // Save settings helper
  const saveSettingsToStorage = (updatedValues = {}) => {
    try {
      const config = {
        projectName,
        projectTitleKh,
        reportTitleEn,
        preparedByName,
        preparedDate,
        preparedSignatureUrl,
        showPreparedSignature,
        approvedByName,
        approvedDate,
        approvedSignatureUrl,
        showApprovedSignature,
        customLogoUrl,
        showLogo,
        showDetailedBreakdown,
        ...updatedValues,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Error saving slip settings to localStorage:', e);
    }
  };

  // Upload handler helper (converts to Base64)
  const handleImageFileUpload = (e, callback) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(locale === 'kh' ? 'ទំហំរូបភាពមិនអាចលើសពី 5MB បានទេ' : 'Image size cannot exceed 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      callback(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [deptRes, posRes, empRes, whRes, leaveTypeRes, branchRes] = await Promise.all([
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/positions').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/company-work-hours').catch(() => ({ data: null })),
        api.get('/leave-types').catch(() => ({ data: [] })),
        api.get('/kiosk-settings').catch(() => ({ data: [] })),
      ]);
      setDepartments(deptRes.data || []);
      setPositions(posRes.data || []);
      setEmployees(empRes.data || []);
      if (whRes.data) setCompanyWorkHours(whRes.data);
      setLeaveTypes(leaveTypeRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err) {
      console.error('Error fetching initial metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (filterDept) query += `&departmentId=${filterDept}`;
      if (filterBranch) query += `&branch=${filterBranch}`;

      const [attendancesRes, leavesRes, overtimesRes] = await Promise.all([
        api.get(`/attendances/history${query}`).catch(() => ({ data: [] })),
        api.get('/leaves').catch(() => ({ data: [] })),
        api.get('/overtimes').catch(() => ({ data: [] })),
      ]);

      const validLogs = (attendancesRes.data || []).filter(log =>
        Boolean(log.checkin1 || log.checkout1 || log.checkin2 || log.checkout2)
      );
      setLogs(validLogs);
      setLeaves(leavesRes.data || []);
      setOvertimes(overtimesRes.data || []);
    } catch (error) {
      console.error('Error loading slip data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, filterDept, filterBranch]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterBranch, selectedStaffId]);

  // Clean up printing single staff ID after print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingSingleStaffId(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Filtered employees list based on filters and search with relevance ranking (ID and Name)
  const filteredEmployees = useMemo(() => {
    const list = employees.filter(emp => {
      if (filterDept && String(emp.departmentId || emp.department?.id) !== String(filterDept)) {
        return false;
      }
      if (filterBranch && emp.branch !== filterBranch) {
        return false;
      }
      if (selectedStaffId !== 'ALL' && emp.staffId !== selectedStaffId) {
        return false;
      }
      return true;
    });

    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return list;

    // Filter and score candidates by relevance
    const scoredList = [];
    for (const emp of list) {
      const staffId = (emp.staffId || '').trim().toLowerCase();
      const nameEn = (emp.nameEn || '').trim().toLowerCase();
      const nameKh = (emp.nameKh || '').trim().toLowerCase();

      let score = 0;

      // 1. Exact matches (highest priority)
      if (staffId === q) {
        score = 1000;
      } else if (nameEn === q || nameKh === q) {
        score = 900;
      }
      // 2. Starts with search query (prefix matching)
      else if (staffId.startsWith(q)) {
        score = 800;
      } else if (nameEn.startsWith(q)) {
        score = 750;
      } else if (nameKh.startsWith(q)) {
        score = 700;
      }
      // 3. Word starts with search query (e.g. Lastname or Firstname matching prefix)
      else if (nameEn.split(/\s+/).some(w => w.startsWith(q))) {
        score = 600;
      } else if (nameKh.split(/\s+/).some(w => w.startsWith(q))) {
        score = 550;
      }
      // 4. Substring contains in ID
      else if (staffId.includes(q)) {
        score = 400;
      }
      // 5. Substring contains in English name
      else if (nameEn.includes(q)) {
        score = 300;
      }
      // 6. Substring contains in Khmer name
      else if (nameKh.includes(q)) {
        score = 250;
      }

      if (score > 0) {
        scoredList.push({ emp, score });
      }
    }

    // Sort by score descending (most relevant first), then by staffId
    scoredList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.emp.staffId || '').localeCompare(b.emp.staffId || '', undefined, { numeric: true });
    });

    return scoredList.map(item => item.emp);
  }, [employees, filterDept, filterBranch, selectedStaffId, searchTerm]);

  // Compute calculated slip summary for each employee
  const employeeSlipsData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const defaultS1Start = companyWorkHours?.shift1Start || '08:00';
    const defaultS2Start = companyWorkHours?.shift2Start || '13:00';
    const defaultS1End = companyWorkHours?.shift1End || '12:00';
    const defaultS2End = companyWorkHours?.shift2End || '17:00';
    const grace = Number(companyWorkHours?.lateGraceMinutes) || 0;

    // Build leaves map by staffId
    const employeeLeavesMap = new Map();
    leaves.forEach(lv => {
      const st = (lv.status || '').toLowerCase();
      if (st === 'approved') {
        const sId = lv.staffId || lv.employee?.staffId;
        if (sId) {
          const rawDate = lv.leaveDate || lv.startDate || lv.createdAt || '';
          const dateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';
          if (dateStr >= startDate && dateStr <= endDate) {
            if (!employeeLeavesMap.has(sId)) {
              employeeLeavesMap.set(sId, []);
            }
            employeeLeavesMap.get(sId).push(lv);
          }
        }
      }
    });

    // Build overtimes map by staffId
    const employeeOvertimesMap = new Map();
    overtimes.forEach(ot => {
      const st = (ot.status || '').toLowerCase();
      if (st === 'approved') {
        const sId = ot.staffId || ot.employee?.staffId;
        if (sId) {
          const rawDate = ot.overtimeDate || ot.startDate || ot.createdAt || '';
          const dateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';
          if (dateStr >= startDate && dateStr <= endDate) {
            if (!employeeOvertimesMap.has(sId)) {
              employeeOvertimesMap.set(sId, []);
            }
            employeeOvertimesMap.get(sId).push(ot);
          }
        }
      }
    });

    // Build attendance logs map by staffId
    const employeeLogsMap = new Map();
    logs.forEach(log => {
      const sId = log.staffId || log.employee?.staffId;
      if (sId) {
        if (!employeeLogsMap.has(sId)) {
          employeeLogsMap.set(sId, []);
        }
        employeeLogsMap.get(sId).push(log);
      }
    });

    return filteredEmployees.map(emp => {
      const empLogs = employeeLogsMap.get(emp.staffId) || [];
      const empLeaves = employeeLeavesMap.get(emp.staffId) || [];
      const empOvertimes = employeeOvertimesMap.get(emp.staffId) || [];

      const s1StartStr = (emp.shift1Start && emp.shift1Start.trim() !== '') ? emp.shift1Start : defaultS1Start;
      const s2StartStr = (emp.shift2Start && emp.shift2Start.trim() !== '') ? emp.shift2Start : defaultS2Start;
      const s1EndStr = (emp.shift1End && emp.shift1End.trim() !== '') ? emp.shift1End : defaultS1End;
      const s2EndStr = (emp.shift2End && emp.shift2End.trim() !== '') ? emp.shift2End : defaultS2End;

      const s1StartMin = timeToMinutes(s1StartStr) ?? 480;
      const s2StartMin = timeToMinutes(s2StartStr) ?? 780;
      const s1EndMin = timeToMinutes(s1EndStr) ?? 720;
      const s2EndMin = timeToMinutes(s2EndStr) ?? 1020;

      const s1GraceThreshold = s1StartMin + grace;
      const s2GraceThreshold = s2StartMin + grace;

      // Counters
      let lateMorningDays = 0;
      let lateMorningMinutes = 0;

      let lateAfternoonDays = 0;
      let lateAfternoonMinutes = 0;

      let earlyMorningDays = 0;
      let earlyMorningMinutes = 0;

      let earlyAfternoonDays = 0;
      let earlyAfternoonMinutes = 0;

      // Detailed incidents list for Part 2 report
      const incidentList = [];

      empLogs.forEach(log => {
        const c1 = log.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' && log.checkin1.trim() !== '' ? log.checkin1 : null;
        const c2 = log.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' && log.checkin2.trim() !== '' ? log.checkin2 : null;
        const o1 = log.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' && log.checkout1.trim() !== '' ? log.checkout1 : null;
        const o2 = log.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' && log.checkout2.trim() !== '' ? log.checkout2 : null;

        const c1Min = timeToMinutes(c1);
        const c2Min = timeToMinutes(c2);
        const o1Min = timeToMinutes(o1);
        const o2Min = timeToMinutes(o2);

        // Shift 1 Late Morning
        if (c1Min !== null && c1Min > s1GraceThreshold) {
          const diff = c1Min - s1StartMin;
          lateMorningDays += 1;
          lateMorningMinutes += diff;

          incidentList.push({
            date: log.attendanceDate ? String(log.attendanceDate).split('T')[0] : '',
            shiftText: `Shift 1: IN : ${formatTime12Hour(c1)} - OUT : ${o1 ? formatTime12Hour(o1) : '--:--'}`,
            lateMinutes: diff,
            lateFormatted: `${diff}m`,
            description: 'Checkin: Late Morning',
            type: 'late',
          });
        }

        // Shift 2 Late Afternoon
        if (c2Min !== null && c2Min > s2GraceThreshold) {
          const diff = c2Min - s2StartMin;
          lateAfternoonDays += 1;
          lateAfternoonMinutes += diff;

          incidentList.push({
            date: log.attendanceDate ? String(log.attendanceDate).split('T')[0] : '',
            shiftText: `Shift 2: IN : ${formatTime12Hour(c2)} - OUT : ${o2 ? formatTime12Hour(o2) : '--:--'}`,
            lateMinutes: diff,
            lateFormatted: `${diff}m`,
            description: 'Checkin: Late Afternoon',
            type: 'late',
          });
        }

        // Shift 1 Early Morning Out
        if (o1Min !== null && o1Min < s1EndMin) {
          const diff = s1EndMin - o1Min;
          earlyMorningDays += 1;
          earlyMorningMinutes += diff;
        }

        // Shift 2 Early Afternoon Out
        if (o2Min !== null && o2Min < s2EndMin) {
          const diff = s2EndMin - o2Min;
          earlyAfternoonDays += 1;
          earlyAfternoonMinutes += diff;
        }
      });

      // Build quick lookup for this employee's logs: key = dateStr
      const empDateLogsMap = new Map();
      empLogs.forEach(l => {
        const dStr = l.attendanceDate ? String(l.attendanceDate).split('T')[0] : '';
        if (dStr) empDateLogsMap.set(dStr, l);
      });

      // Build quick lookup for this employee's leaves: key = dateStr -> array of leaves
      const empDateLeavesMap = new Map();
      empLeaves.forEach(lv => {
        const rawDate = lv.leaveDate || lv.startDate || lv.createdAt || '';
        const dStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';
        if (dStr) {
          if (!empDateLeavesMap.has(dStr)) empDateLeavesMap.set(dStr, []);
          empDateLeavesMap.get(dStr).push(lv);
        }
      });

      // Calculate Incomplete Shifts / Missing Scans count (matching AttendanceIncomplete.jsx)
      let missedCheckinDays = 0; // Number of days with incomplete/missing scans
      let missingInCount = 0;
      let missingOutCount = 0;

      // Determine working days for this employee
      let empWorkingDays = [1, 2, 3, 4, 5, 6];
      let empFlexibleObj = {};
      if (companyWorkHours?.flexibleSchedule) {
        try {
          const parsed = typeof companyWorkHours.flexibleSchedule === 'string'
            ? JSON.parse(companyWorkHours.flexibleSchedule)
            : companyWorkHours.flexibleSchedule;
          if (Array.isArray(parsed?.workingDays)) empWorkingDays = parsed.workingDays;
        } catch (e) {}
      }
      if (emp.flexibleSchedule) {
        try {
          empFlexibleObj = typeof emp.flexibleSchedule === 'string'
            ? JSON.parse(emp.flexibleSchedule)
            : emp.flexibleSchedule;
          if (Array.isArray(empFlexibleObj?.workingDays)) {
            empWorkingDays = empFlexibleObj.workingDays;
          }
        } catch (e) {}
      }

      // Check Shift 2 enabled
      const hasShift2 = Boolean(
        (s2StartStr && s2EndStr && s2StartStr.trim() !== '' && s2EndStr.trim() !== '')
      );

      // Generate all calendar dates in date range
      const cur = new Date(startDate);
      const stop = new Date(endDate);
      while (cur <= stop) {
        const dateStr = cur.toISOString().split('T')[0];
        cur.setDate(cur.getDate() + 1);

        // Check employee join date
        if (emp.joinDate && dateStr < emp.joinDate) continue;

        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();

        // Check if working day
        const dateSchedule = empFlexibleObj[dateStr];
        let isWorkingDay = empWorkingDays.includes(dayOfWeek);
        if (dateSchedule) {
          if (dateSchedule.isDayOff === true || dateSchedule.working === false) {
            isWorkingDay = false;
          } else if (dateSchedule.isWorkingDay === true || dateSchedule.working === true) {
            isWorkingDay = true;
          }
        }

        const log = empDateLogsMap.get(dateStr);
        const c1 = log?.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' && log.checkin1.trim() !== '' ? log.checkin1 : null;
        const o1 = log?.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' && log.checkout1.trim() !== '' ? log.checkout1 : null;
        const c2 = log?.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' && log.checkin2.trim() !== '' ? log.checkin2 : null;
        const o2 = log?.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' && log.checkout2.trim() !== '' ? log.checkout2 : null;
        const hasAnyScan = Boolean(c1 || o1 || c2 || o2);

        // Skip non-working day without scans
        if (!isWorkingDay && !hasAnyScan) continue;

        // Check leaves
        const dayLeaves = empDateLeavesMap.get(dateStr) || [];
        let hasFullDayLeave = false;
        let hasMorningLeave = false;
        let hasAfternoonLeave = false;

        dayLeaves.forEach(lv => {
          const dur = lv.durationType || '';
          const days = Number(lv.amountDays) || 1;
          const reason = (lv.reason || '').toLowerCase();
          if (dur === 'Full Day' || days >= 1.0 || (!dur && days >= 1.0)) {
            hasFullDayLeave = true;
          } else if (dur === 'Morning' || reason.includes('morning') || reason.includes('shift 1') || reason.includes('វេនទី ១')) {
            hasMorningLeave = true;
          } else if (dur === 'Afternoon' || reason.includes('afternoon') || reason.includes('shift 2') || reason.includes('វេនទី ២')) {
            hasAfternoonLeave = true;
          } else if (days <= 0.5) {
            hasMorningLeave = true;
          }
        });

        // Skip full day leave without scans
        if (hasFullDayLeave && !hasAnyScan) continue;

        // Evaluate missing scans
        const shift1Required = (!hasMorningLeave) || Boolean(c1 || o1);
        const shift2Required = (hasShift2 && !hasAfternoonLeave) || Boolean(c2 || o2);

        const missingCheckin1 = shift1Required && !c1;
        const missingCheckout1 = shift1Required && !o1;
        const missingCheckin2 = shift2Required && !c2;
        const missingCheckout2 = shift2Required && !o2;

        if (missingCheckin1 || missingCheckout1 || missingCheckin2 || missingCheckout2) {
          missedCheckinDays += 1;
          if (missingCheckin1) missingInCount += 1;
          if (missingCheckin2) missingInCount += 1;
          if (missingCheckout1) missingOutCount += 1;
          if (missingCheckout2) missingOutCount += 1;
        }
      }

      incidentList.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Overtime Calculations
      let normalOtHours = 0;
      let holidayOtHours = 0;

      empOvertimes.forEach(ot => {
        const hours = Number(ot.hours) || (Number(ot.amountDay) ? Number(ot.amountDay) * 8 : 0);
        const otType = (ot.overtimeType || ot.type || '').toLowerCase();
        const otDateStr = ot.overtimeDate || ot.startDate || '';
        const dayOfWeek = otDateStr ? new Date(otDateStr).getDay() : 1;

        if (otType.includes('holiday') || otType.includes('sunday') || dayOfWeek === 0) {
          holidayOtHours += hours;
        } else {
          normalOtHours += hours;
        }
      });

      // Leave Requests Calculation by Category
      let annualLeaveDays = 0;
      let sickLeaveDays = 0;
      let specialLeaveDays = 0;
      let maternityLeaveDays = 0;
      let unpaidLeaveDays = 0;

      empLeaves.forEach(lv => {
        const days = Number(lv.amountDays) || 1;
        const code = (lv.leaveTypeCode || lv.leaveType?.code || '').toUpperCase();
        const name = (lv.leaveType?.nameEn || lv.leaveType?.nameKh || lv.reason || '').toLowerCase();

        if (code === 'AL' || name.includes('annual') || name.includes('ប្រចាំឆ្នាំ')) {
          annualLeaveDays += days;
        } else if (code === 'SL' || name.includes('sick') || name.includes('ឈឺ')) {
          sickLeaveDays += days;
        } else if (code === 'SPL' || name.includes('special') || name.includes('ពិសេស')) {
          specialLeaveDays += days;
        } else if (code === 'ML' || name.includes('maternity') || name.includes('សម្រាល')) {
          maternityLeaveDays += days;
        } else if (code === 'UP' || name.includes('unpaid') || name.includes('ឥតប្រាក់ឈ្នួល') || name.includes('មិនគិតប្រាក់')) {
          unpaidLeaveDays += days;
        } else {
          annualLeaveDays += days;
        }
      });

      const totalLateCount = lateMorningDays + lateAfternoonDays;
      const totalLateMinutes = lateMorningMinutes + lateAfternoonMinutes;
      const totalMissingScans = missingInCount + missingOutCount;

      return {
        emp,
        lateMorningDays,
        lateMorningTime: formatDurationHHMMSS(lateMorningMinutes),
        lateAfternoonDays,
        lateAfternoonTime: formatDurationHHMMSS(lateAfternoonMinutes),
        earlyMorningDays,
        earlyMorningTime: formatDurationHHMMSS(earlyMorningMinutes),
        earlyAfternoonDays,
        earlyAfternoonTime: formatDurationHHMMSS(earlyAfternoonMinutes),
        missedCheckinDays: totalMissingScans,
        totalMissingScans,
        missingInCount,
        missingOutCount,
        incompleteDaysCount: missedCheckinDays,
        normalOtHours,
        holidayOtHours,
        annualLeaveDays,
        sickLeaveDays,
        specialLeaveDays,
        maternityLeaveDays,
        unpaidLeaveDays,
        incidentList,
        totalLateCount,
        totalLateMinutes,
      };
    });
  }, [filteredEmployees, logs, leaves, overtimes, companyWorkHours, startDate, endDate]);

  // Paginated slips for UI display
  const totalSlips = employeeSlipsData.length;
  const totalPages = Math.ceil(totalSlips / slipsPerPage) || 1;
  const paginatedSlips = useMemo(() => {
    if (selectedStaffId !== 'ALL') return employeeSlipsData;
    return employeeSlipsData.slice((currentPage - 1) * slipsPerPage, currentPage * slipsPerPage);
  }, [employeeSlipsData, currentPage, slipsPerPage, selectedStaffId]);

  // Effective logo and signature source
  const effectiveLogo = customLogoUrl || khyhengLogoDefault;
  const effectivePreparedSignature = preparedSignatureUrl || chandaraSignatureDefault;

  // Print function (All Employees)
  const handlePrint = () => {
    setPrintingSingleStaffId(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Print function (Single Employee Slip)
  const handlePrintSingleEmployee = (staffId) => {
    setPrintingSingleStaffId(staffId);
    setTimeout(() => {
      window.print();
      setPrintingSingleStaffId(null);
    }, 150);
  };

  // Helper: convert any image URL/Asset to base64 Data URI
  const getBase64FromUrl = async (url) => {
    if (!url) return '';
    if (typeof url === 'string' && url.startsWith('data:image')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to convert image to base64 for Excel:', e);
      return '';
    }
  };

  // Export Excel Function (All Employees or Single Employee)
  const handleExportExcel = async (singleSlip = null) => {
    const listToExport = singleSlip ? [singleSlip] : employeeSlipsData;
    if (listToExport.length === 0) return;

    // Convert logo and signatures to base64 for embedding in Excel
    const logoBase64 = showLogo ? await getBase64FromUrl(effectiveLogo) : '';
    const prepSignBase64 = showPreparedSignature ? await getBase64FromUrl(effectivePreparedSignature) : '';
    const appSignBase64 = (showApprovedSignature && approvedSignatureUrl) ? await getBase64FromUrl(approvedSignatureUrl) : '';

    let excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Attendance Slip</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Khmer OS Battambang', 'Battambang', Calibri, 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; color: #000000; }
          .main-table { border-collapse: collapse; width: 100%; max-width: 650px; margin: 0 auto; border: 1.5px solid #000000; }
          .main-table th, .main-table td { border: 1px solid #000000; padding: 5px 8px; font-size: 10pt; color: #000000; }
          .th-orange { background-color: #f59e0b; font-weight: bold; text-align: center; }
          .th-green { background-color: #84cc16; font-weight: bold; text-align: center; }
          .center { text-align: center; }
          .left { text-align: left; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
    `;

    listToExport.forEach((slip) => {
      const { emp } = slip;
      const deptName = getLocalizedName(emp.department?.nameEn, emp.department?.nameKh) || '-';
      const posTitle = getLocalizedName(emp.position?.titleEn, emp.position?.titleKh) || '-';
      const empFullName = `${emp.nameEn || ''}${emp.nameKh ? ' (' + emp.nameKh + ')' : ''}`;

      excelHtml += `
        <div style="page-break-after: always; margin-bottom: 40px;">
          <table class="main-table">
            <colgroup>
              <col style="width: 42%;" />
              <col style="width: 29%;" />
              <col style="width: 29%;" />
            </colgroup>

            <tbody>
              <!-- Row 1: Logo (Left) and Title (Right) -->
              <tr>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; vertical-align: middle;">
                  ${logoBase64 ? `<img src="${logoBase64}" width="130" style="max-height: 65px; object-fit: contain; margin: 0 auto; display: block;" />` : ''}
                </td>
                <td colspan="2" style="border: 1px solid #000000; padding: 8px; text-align: center; vertical-align: middle;">
                  ${projectTitleKh ? `<div style="font-family: 'Khmer OS Muol Light', 'Khmer OS Muol', 'Moul', serif; font-size: 16pt; font-weight: bold; margin-bottom: 3px; color: #000000;">${projectTitleKh}</div>` : ''}
                  <div style="font-size: 13pt; font-weight: bold; color: #000000;">${projectName}</div>
                </td>
              </tr>

              <!-- Employee Information Rows -->
              <tr>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: left; padding: 5px 8px;">
                  ឈ្មោះបុគ្គលិក / Employee Name:
                </td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">
                  ${empFullName}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: left; padding: 5px 8px;">
                  ភេទ / Sex:
                </td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">
                  ${emp.gender === 'Female' ? 'Female' : 'Male'}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: left; padding: 5px 8px;">
                  អត្តលេខ / ID:
                </td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">
                  ${emp.staffId || ''}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: left; padding: 5px 8px;">
                  តួនាទី / Position:
                </td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">
                  ${posTitle}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: left; padding: 5px 8px;">
                  នាយកដ្ឋាន / Department:
                </td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">
                  ${deptName}
                </td>
              </tr>

              <!-- Attendance Metrics Header (Orange) -->
              <tr>
                <td style="border: 1px solid #000000; background-color: #f59e0b; font-weight: bold; text-align: center; padding: 5px 8px;">
                  បរិយាយ
                </td>
                <td style="border: 1px solid #000000; background-color: #f59e0b; font-weight: bold; text-align: center; padding: 5px 8px;">
                  ចំនួនថ្ងៃ
                </td>
                <td style="border: 1px solid #000000; background-color: #f59e0b; font-weight: bold; text-align: center; padding: 5px 8px;">
                  ចំនួនម៉ោង
                </td>
              </tr>

              <!-- Attendance Metrics Rows -->
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">មកយឺតពេលព្រឹក/Late Morning</td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.lateMorningDays}</td>
                <td style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">${slip.lateMorningTime}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">មកយឺតពេលថ្ងៃ/Late Afternoon</td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.lateAfternoonDays}</td>
                <td style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">${slip.lateAfternoonTime}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">ចេញលឿនព្រឹក/Early Morning</td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.earlyMorningDays}</td>
                <td style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">${slip.earlyMorningTime}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">ចេញលឿនល្ងាច/Early Afternoon</td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.earlyAfternoonDays}</td>
                <td style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">${slip.earlyAfternoonTime}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">ភ្លេចស្កេន Check-in</td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.missedCheckinDays}</td>
                <td style="border: 1px solid #000000; text-align: center; padding: 5px 8px;">0</td>
              </tr>

              <!-- Overtime Section -->
              <tr>
                <td colspan="3" style="border: 1px solid #000000; background-color: #84cc16; font-weight: bold; text-align: center; padding: 5px 8px;">
                  ធ្វើការថែមម៉ោង/Overtime
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; background-color: #f59e0b; font-weight: bold; text-align: center; padding: 5px 8px;">
                  បរិយាយ
                </td>
                <td colspan="2" style="border: 1px solid #000000; background-color: #f59e0b; font-weight: bold; text-align: center; padding: 5px 8px;">
                  ចំនួនម៉ោង
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">ថែមម៉ោងថ្ងៃធម្មតា/Normal OT</td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.normalOtHours}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: left; padding: 5px 8px;">ថែមម៉ោងថ្ងៃអាទិត្យ ឬបុណ្យ/Holiday OT</td>
                <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 5px 8px;">${slip.holidayOtHours}</td>
              </tr>

              <!-- Leave Requests Section -->
              <tr>
                <td rowspan="6" style="border: 1px solid #000000; vertical-align: middle; text-align: center; font-weight: bold; background-color: #ffffff; padding: 6px 8px;">
                  ការស្នើសុំច្បាប់ឈប់សម្រាក
                </td>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: center; padding: 4px 6px;">
                  ប្រភេទច្បាប់
                </td>
                <td style="border: 1px solid #000000; font-weight: bold; text-align: center; padding: 4px 6px;">
                  ចំនួនថ្ងៃ
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: center; font-size: 8.5pt; padding: 3px 5px;">
                  ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ/Annual Leave
                </td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 3px 5px;">
                  ${slip.annualLeaveDays}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: center; font-size: 8.5pt; padding: 3px 5px;">
                  ច្បាប់ឈឺ/Sick Leave
                </td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 3px 5px;">
                  ${slip.sickLeaveDays}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: center; font-size: 8.5pt; padding: 3px 5px;">
                  ច្បាប់ពិសេស/Special Leave
                </td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 3px 5px;">
                  ${slip.specialLeaveDays}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: center; font-size: 8.5pt; padding: 3px 5px;">
                  ML (Maternity Leave)
                </td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 3px 5px;">
                  ${slip.maternityLeaveDays}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000000; text-align: center; font-size: 8.5pt; padding: 3px 5px;">
                  ច្បាប់មិនគិតប្រាក់ឈ្នួល/Unpaid
                </td>
                <td style="border: 1px solid #000000; text-align: center; font-weight: bold; padding: 3px 5px;">
                  ${slip.unpaidLeaveDays}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Signatures Section below table -->
          <table style="border: none; width: 100%; max-width: 650px; margin: 15px auto 0 auto; border-collapse: collapse;">
            <tr style="border: none;">
              <td style="border: none; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
                <div style="font-weight: bold; font-size: 11pt; margin-bottom: 2px;">រៀបចំដោយ</div>
                <div style="height: 48px; display: flex; align-items: center; justify-content: center; margin: 2px auto;">
                  ${prepSignBase64 ? `<img src="${prepSignBase64}" height="42" style="max-height: 42px; object-fit: contain; margin: 0 auto; display: block;" />` : `<div style="height: 42px;"></div>`}
                </div>
                <div style="font-weight: bold; font-size: 10pt; margin-top: 2px;">${preparedByName}</div>
                <div style="color: #000000; font-size: 10pt; margin: 2px 0;">-----------------------------------</div>
                <div style="font-size: 10pt;">${preparedDate}</div>
              </td>
              <td style="border: none; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
                <div style="font-weight: bold; font-size: 11pt; margin-bottom: 2px;">យល់ព្រមដោយ</div>
                <div style="height: 48px; display: flex; align-items: center; justify-content: center; margin: 2px auto;">
                  ${appSignBase64 ? `<img src="${appSignBase64}" height="42" style="max-height: 42px; object-fit: contain; margin: 0 auto; display: block;" />` : `<div style="height: 42px;"></div>`}
                </div>
                <div style="font-weight: bold; font-size: 10pt; margin-top: 2px;">${approvedByName || '&nbsp;'}</div>
                <div style="color: #000000; font-size: 10pt; margin: 2px 0;">-----------------------------------</div>
                <div style="font-size: 10pt;">${approvedDate}</div>
              </td>
            </tr>
          </table>
        </div>
      `;
    });

    excelHtml += `</body></html>`;

    const fileName = singleSlip
      ? `Attendance_Slip_${singleSlip.emp.staffId || 'Employee'}_${startDate}_to_${endDate}.xls`
      : `Attendance_Slip_Report_${startDate}_to_${endDate}.xls`;

    const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-100 pb-16">
      {/* Hidden file inputs for uploading signatures and logo */}
      <input
        ref={preparedSignatureInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          handleImageFileUpload(e, (base64) => {
            setPreparedSignatureUrl(base64);
            saveSettingsToStorage({ preparedSignatureUrl: base64 });
          });
        }}
      />
      <input
        ref={approvedSignatureInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          handleImageFileUpload(e, (base64) => {
            setApprovedSignatureUrl(base64);
            saveSettingsToStorage({ approvedSignatureUrl: base64 });
          });
        }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          handleImageFileUpload(e, (base64) => {
            setCustomLogoUrl(base64);
            saveSettingsToStorage({ customLogoUrl: base64 });
          });
        }}
      />

      {/* Stylesheet injection with Khmer OS Battambang font and 2-Page A4 Print */}
      <style>{`
        .slip-card-box,
        .slip-card-box * {
          font-family: 'Khmer OS Battambang', 'Battambang', 'Kantumruy Pro', sans-serif;
        }
        .slip-title-muol {
          font-family: 'Khmer OS Muol Light', 'Khmer OS Muol', 'Moul', serif !important;
          font-size: 18pt !important;
          font-weight: bold !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Khmer OS Battambang', 'Battambang', 'Kantumruy Pro', sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          /* Neutralize all app layout scroll/overflow/flex wrappers so print starts from the very top without clipping */
          #root, #root > div, .h-screen, div[class*="h-screen"], div[class*="overflow-"], main, div[class*="md:pl-64"] {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          nav, aside, header, .no-print, button, input, select {
            display: none !important;
          }
          .print-container {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .slip-page-item {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .slip-page-1 {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-before: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 0 0 0 !important;
            border: 2px solid #000000 !important;
            border-radius: 0 !important;
            padding: 16px 20px !important;
            background: #ffffff !important;
          }
          .slip-page-2 {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-before: always !important;
            break-before: page !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 0 0 0 !important;
            border: 2px solid #000000 !important;
            border-radius: 0 !important;
            padding: 24px 20px !important;
            background: #ffffff !important;
          }
          .slip-card-box {
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            font-family: 'Khmer OS Battambang', 'Battambang', 'Kantumruy Pro', sans-serif !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .slip-table {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
            font-family: 'Khmer OS Battambang', 'Battambang', 'Kantumruy Pro', sans-serif !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .slip-table th, .slip-table td {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            font-family: 'Khmer OS Battambang', 'Battambang', 'Kantumruy Pro', sans-serif !important;
            font-size: 10pt !important;
            padding: 4.5px 8px !important;
          }
          .slip-table th {
            font-size: 10.5pt !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl glow-indigo flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CalendarDaysIcon className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white font-khmer flex items-center gap-2">
                <span>{locale === 'kh' ? 'ប័ណ្ណវត្តមានបុគ្គលិក (Attendance Slip)' : 'Employee Attendance Slip'}</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {locale === 'kh'
                  ? 'ទាញយក កែប្រែការរចនា ហត្ថលេខា និងបោះពុម្ពប័ណ្ណសង្ខេបវត្តមានសម្រាប់បុគ្គលិកទាំងអស់'
                  : 'Customize template, signature, header and print attendance slips for all employees'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Settings & Design Modal Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer font-khmer"
            title="Design & Settings"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            <span>{locale === 'kh' ? 'ការកំណត់ & ហត្ថលេខា' : 'Settings & Signature'}</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={employeeSlipsData.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>{t('exportExcel')}</span>
          </button>

          {/* Print PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={employeeSlipsData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-500/25 cursor-pointer font-khmer"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>{t('printPdf')}</span>
          </button>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="glass-card p-5 rounded-2xl space-y-4 no-print border border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase font-khmer">
              {t('startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase font-khmer">
              {t('endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase font-khmer">
              {t('departments')}
            </label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:bg-slate-900 outline-none font-khmer cursor-pointer"
            >
              <option value="" className="bg-slate-900">{t('selectDept')} ({t('all')})</option>
              {departments.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900">
                  {getLocalizedName(d.nameEn, d.nameKh)}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase font-khmer">
              {t('branch')}
            </label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:bg-slate-900 outline-none font-khmer cursor-pointer"
            >
              <option value="" className="bg-slate-900">{t('branch')} ({t('all')})</option>
              {branches.map(b => (
                <option key={b.id} value={b.name} className="bg-slate-900">{b.name}</option>
              ))}
            </select>
          </div>

          {/* Employee Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase font-khmer">
              {t('employees')}
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:bg-slate-900 outline-none font-khmer cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">
                ⭐ {locale === 'kh' ? 'បង្ហាញបុគ្គលិកទាំងអស់ (Show All)' : 'Show All Employees'}
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.staffId} className="bg-slate-900">
                  {emp.staffId} - {getLocalizedName(emp.nameEn, emp.nameKh)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Customization Row */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={locale === 'kh' ? 'ស្វែងរក ឈ្មោះ ឬ អត្តលេខ (ID)...' : 'Search Name or Staff ID...'}
                className="pl-8 pr-7 py-1.5 px-3 border border-white/10 bg-slate-950/60 text-white rounded-lg text-xs outline-none focus:border-indigo-500 w-full font-khmer placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Signature Upload Button */}
            <button
              type="button"
              onClick={() => preparedSignatureInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-lg text-slate-200 text-xs transition-colors cursor-pointer font-khmer"
              title="Upload new signature image"
            >
              <PhotoIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{locale === 'kh' ? 'Upload ហត្ថលេខា' : 'Upload Signature'}</span>
            </button>

            {/* Reset to default signature */}
            {preparedSignatureUrl && (
              <button
                type="button"
                onClick={() => {
                  setPreparedSignatureUrl('');
                  saveSettingsToStorage({ preparedSignatureUrl: '' });
                }}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer font-khmer"
              >
                {locale === 'kh' ? 'ប្រើហត្ថលេខាដើម' : 'Reset Signature'}
              </button>
            )}
          </div>

          {/* Toggle Switches */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 font-khmer">
              <input
                type="checkbox"
                checked={showPreparedSignature}
                onChange={(e) => {
                  setShowPreparedSignature(e.target.checked);
                  saveSettingsToStorage({ showPreparedSignature: e.target.checked });
                }}
                className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span>{locale === 'kh' ? 'ហត្ថលេខា' : 'Signature'}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 font-khmer">
              <input
                type="checkbox"
                checked={showDetailedBreakdown}
                onChange={(e) => {
                  setShowDetailedBreakdown(e.target.checked);
                  saveSettingsToStorage({ showDetailedBreakdown: e.target.checked });
                }}
                className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span>{locale === 'kh' ? 'តារាងលម្អិត (Checkin Late)' : 'Detailed Breakdown'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Slip Count Summary Banner */}
      <div className="flex items-center justify-between text-xs text-slate-400 no-print px-1">
        <div>
          <span>{locale === 'kh' ? 'បុគ្គលិកសរុប:' : 'Total Employees:'} </span>
          <span className="font-bold text-white font-mono">{totalSlips}</span>
          <span className="ml-2 text-indigo-400">
            ({formatShortDate(startDate)} - {formatShortDate(endDate)})
          </span>
        </div>

        {selectedStaffId === 'ALL' && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <span>{locale === 'kh' ? 'ទំព័រ' : 'Page'} {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Slips Rendering Container */}
      <div ref={printAreaRef} className="space-y-8 print-container">
        {loading ? (
          <div className="glass-card p-12 text-center text-slate-400 font-khmer rounded-2xl">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p>{t('loading')}</p>
          </div>
        ) : paginatedSlips.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400 font-khmer rounded-2xl">
            {t('noData')}
          </div>
        ) : (
          (printingSingleStaffId
            ? employeeSlipsData.filter(d => d.emp.staffId === printingSingleStaffId)
            : (selectedStaffId === 'ALL' ? employeeSlipsData : paginatedSlips)
          ).map((data, idx) => {
            const { emp } = data;
            const isVisibleOnScreen = printingSingleStaffId
              ? true
              : (selectedStaffId !== 'ALL' || (idx >= (currentPage - 1) * slipsPerPage && idx < currentPage * slipsPerPage));
            return (
              <div
                key={emp.id || emp.staffId}
                className={`slip-page-item w-full max-w-4xl mx-auto space-y-4 ${isVisibleOnScreen ? 'block' : 'hidden print:block'}`}
              >
                {/* Visual Label (Page 1) in UI (hidden in print) */}
                <div className="no-print flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <span>📄 {locale === 'kh' ? 'ទំព័រទី ១: ប័ណ្ណវត្តមានបុគ្គលិក' : 'Page 1: Attendance Slip'}</span>
                  </span>
                  <span className="font-mono text-slate-300">
                    {emp.staffId} - {emp.nameEn || emp.nameKh}
                  </span>
                </div>

                {/* ================= PAGE 1: ATTENDANCE SLIP (A4 Page 1) ================= */}
                <div className="slip-page-1 slip-card-box bg-white text-black p-6 sm:p-7 rounded-xl shadow-xl border border-slate-300 font-sans relative">
                  <div>
                    {/* Top Header Box (Logo on Left, Khmer OS Muol Light 18pt bold on Right, Print button top-right) */}
                    <table className="slip-table w-full border-collapse border border-black mb-0">
                      <tbody>
                        <tr>
                          {showLogo && (
                            <td className="border border-black p-2.5 w-[28%] sm:w-[25%] text-center align-middle bg-white">
                              <div className="relative group inline-block">
                                <img
                                  src={effectiveLogo}
                                  alt="Company Logo"
                                  className="h-16 sm:h-20 object-contain mx-auto"
                                />
                                {/* Quick change logo hover in UI (hidden in print) */}
                                <button
                                  type="button"
                                  onClick={() => logoInputRef.current?.click()}
                                  className="no-print absolute inset-0 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity cursor-pointer font-khmer"
                                  title="Change Logo"
                                >
                                  ផ្លាស់ប្ដូរ Logo
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="border border-black p-3 text-center align-middle bg-white relative">
                            {/* Individual Action Buttons (Screen only, hidden in print) */}
                            <div className="no-print absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex items-center gap-1.5">
                              {/* Save as Excel Button */}
                              <button
                                type="button"
                                onClick={() => handleExportExcel(data)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-khmer shadow-sm hover:shadow transition-all cursor-pointer"
                                title={locale === 'kh' ? 'ទាញយកជា Excel សម្រាប់បុគ្គលិកនេះ' : 'Download Excel for this employee'}
                              >
                                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                <span>Excel</span>
                              </button>

                              {/* Print Button */}
                              <button
                                type="button"
                                onClick={() => handlePrintSingleEmployee(emp.staffId)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-xs font-bold font-khmer shadow-sm hover:shadow transition-all cursor-pointer"
                                title={locale === 'kh' ? 'បោះពុម្ពប័ណ្ណបុគ្គលិកនេះ' : 'Print this employee slip'}
                              >
                                <PrinterIcon className="w-3.5 h-3.5" />
                                <span>{locale === 'kh' ? 'បោះពុម្ព' : 'Print'}</span>
                              </button>
                            </div>

                            <h1
                              className="slip-title-muol text-lg sm:text-[18pt] font-bold text-black tracking-wide leading-tight px-12 sm:px-16"
                              style={{
                                fontFamily: "'Khmer OS Muol Light', 'Khmer OS Muol', 'Moul', serif",
                                fontSize: '18pt',
                                fontWeight: 'bold',
                              }}
                            >
                              {projectTitleKh}
                            </h1>
                            <h2 className="text-sm sm:text-[14pt] font-bold text-black tracking-wider mt-1.5">
                              {projectName}
                            </h2>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Employee Info Table */}
                    <table className="slip-table w-full border-collapse border border-black mb-0 text-xs sm:text-sm -mt-[1px]">
                      <tbody>
                        <tr>
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer w-5/12 bg-white">
                            ឈ្មោះបុគ្គលិក / Employee Name:
                          </td>
                          <td className="border border-black px-3 py-1.5 font-semibold text-center bg-white">
                            {emp.nameEn || ''} {emp.nameKh ? `(${emp.nameKh})` : ''}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer bg-white">
                            ភេទ / Sex:
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center bg-white">
                            {emp.gender === 'Female' ? 'Female' : 'Male'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer bg-white">
                            អត្តលេខ / ID:
                          </td>
                          <td className="border border-black px-3 py-1.5 font-mono font-bold text-center bg-white">
                            {emp.staffId}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer bg-white">
                            តួនាទី / Position:
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center bg-white">
                            {getLocalizedName(emp.position?.titleEn, emp.position?.titleKh) || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer bg-white">
                            នាយកដ្ឋាន / Department:
                          </td>
                          <td className="border border-black px-3 py-1.5 text-center bg-white">
                            {getLocalizedName(emp.department?.nameEn, emp.department?.nameKh) || '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Attendance Summary & Overtime & Leave Request Table */}
                    <table className="slip-table w-full border-collapse border border-black text-xs sm:text-sm -mt-[1px]">
                      <thead>
                        <tr className="bg-[#f59e0b] text-black">
                          <th className="border border-black px-3 py-1.5 font-bold font-khmer text-center w-5/12">
                            បរិយាយ
                          </th>
                          <th className="border border-black px-3 py-1.5 font-bold font-khmer text-center w-3/12">
                            ចំនួនថ្ងៃ
                          </th>
                          <th className="border border-black px-3 py-1.5 font-bold font-khmer text-center w-4/12">
                            ចំនួនម៉ោង
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Late Morning */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            មកយឺតពេលព្រឹក/Late Morning
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-bold font-mono">
                            {data.lateMorningDays}
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                            {data.lateMorningTime}
                          </td>
                        </tr>

                        {/* Late Afternoon */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            មកយឺតពេលថ្ងៃ/Late Afternoon
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-bold font-mono">
                            {data.lateAfternoonDays}
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                            {data.lateAfternoonTime}
                          </td>
                        </tr>

                        {/* Early Morning Out */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            ចេញលឿនព្រឹក/Early Morning
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-bold font-mono">
                            {data.earlyMorningDays}
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                            {data.earlyMorningTime}
                          </td>
                        </tr>

                        {/* Early Afternoon Out */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            ចេញលឿនល្ងាច/Early Afternoon
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-bold font-mono">
                            {data.earlyAfternoonDays}
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                            {data.earlyAfternoonTime}
                          </td>
                        </tr>

                        {/* Missed Checkin */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            ភ្លេចស្កេន Check-in
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-bold font-mono">
                            {data.missedCheckinDays}
                          </td>
                          <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                            0
                          </td>
                        </tr>

                        {/* Overtime Header (Green) */}
                        <tr className="bg-[#84cc16] text-black">
                          <td colSpan={3} className="border border-black px-3 py-1.5 font-bold font-khmer text-center">
                            ធ្វើការថែមម៉ោង/Overtime
                          </td>
                        </tr>

                        {/* Overtime Subheader (Orange) */}
                        <tr className="bg-[#f59e0b] text-black">
                          <td className="border border-black px-3 py-1.5 font-bold font-khmer text-center">
                            បរិយាយ
                          </td>
                          <td colSpan={2} className="border border-black px-3 py-1.5 font-bold font-khmer text-center">
                            ចំនួនម៉ោង
                          </td>
                        </tr>

                        {/* Normal OT */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            ថែមម៉ោងថ្ងៃធម្មតា/Normal OT
                          </td>
                          <td colSpan={2} className="border border-black px-3 py-1 text-center font-mono font-bold">
                            {data.normalOtHours}
                          </td>
                        </tr>

                        {/* Holiday / Sunday OT */}
                        <tr>
                          <td className="border border-black px-3 py-1 font-khmer">
                            ថែមម៉ោងថ្ងៃអាទិត្យ ឬបុណ្យ/Holiday OT
                          </td>
                          <td colSpan={2} className="border border-black px-3 py-1 text-center font-mono font-bold">
                            {data.holidayOtHours}
                          </td>
                        </tr>

                        {/* Leave Request Rows */}
                        <tr>
                          <td
                            rowSpan={6}
                            className="border border-black px-3 py-3 text-center font-bold font-khmer align-middle bg-slate-50/50"
                          >
                            ការស្នើសុំច្បាប់ឈប់សម្រាក
                          </td>
                          <td className="border border-black px-3 py-1 font-bold font-khmer text-center bg-slate-100">
                            ប្រភេទច្បាប់
                          </td>
                          <td className="border border-black px-3 py-1 font-bold font-khmer text-center bg-slate-100">
                            ចំនួនថ្ងៃ
                          </td>
                        </tr>

                        {/* Annual Leave */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 font-khmer text-center text-xs">
                            ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ/Annual Leave
                          </td>
                          <td className="border border-black px-3 py-0.5 text-center font-mono font-bold">
                            {data.annualLeaveDays}
                          </td>
                        </tr>

                        {/* Sick Leave */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 font-khmer text-center text-xs">
                            ច្បាប់ឈឺ/Sick Leave
                          </td>
                          <td className="border border-black px-3 py-0.5 text-center font-mono font-bold">
                            {data.sickLeaveDays}
                          </td>
                        </tr>

                        {/* Special Leave */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 font-khmer text-center text-xs">
                            ច្បាប់ពិសេស/Special Leave
                          </td>
                          <td className="border border-black px-3 py-0.5 text-center font-mono font-bold">
                            {data.specialLeaveDays}
                          </td>
                        </tr>

                        {/* Maternity Leave */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 font-khmer text-center text-xs">
                            ML (Maternity Leave)
                          </td>
                          <td className="border border-black px-3 py-0.5 text-center font-mono font-bold">
                            {data.maternityLeaveDays}
                          </td>
                        </tr>

                        {/* Unpaid Leave */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 font-khmer text-center text-xs">
                            ច្បាប់មិនគិតប្រាក់ឈ្នួល/Unpaid
                          </td>
                          <td className="border border-black px-3 py-0.5 text-center font-mono font-bold">
                            {data.unpaidLeaveDays}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures Section */}
                  <div className="grid grid-cols-2 gap-8 mt-4 pt-2 text-xs sm:text-sm">
                    {/* Left: Prepared By */}
                    <div className="flex flex-col items-center text-center">
                      <h4 className="font-bold font-khmer mb-1">រៀបចំដោយ</h4>
                      {showPreparedSignature ? (
                        <div className="relative group h-14 flex items-center justify-center">
                          <img
                            src={effectivePreparedSignature}
                            alt="Prepared Signature"
                            className="h-12 object-contain"
                          />
                          {/* Quick change signature on hover in UI */}
                          <button
                            type="button"
                            onClick={() => preparedSignatureInputRef.current?.click()}
                            className="no-print absolute inset-0 bg-indigo-900/70 text-white rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity cursor-pointer font-khmer gap-1"
                            title="Upload new signature"
                          >
                            <PhotoIcon className="w-3 h-3" />
                            <span>ផ្លាស់ប្ដូរ</span>
                          </button>
                        </div>
                      ) : (
                        <div className="h-14"></div>
                      )}
                      <div className="font-bold font-khmer text-indigo-950 mt-1">
                        {preparedByName}
                      </div>
                      <div className="w-40 border-b border-dotted border-black my-1"></div>
                      <div className="text-xs font-mono">{preparedDate}</div>
                    </div>

                    {/* Right: Approved By */}
                    <div className="flex flex-col items-center text-center justify-between">
                      <h4 className="font-bold font-khmer mb-1">យល់ព្រមដោយ</h4>
                      {approvedSignatureUrl && showApprovedSignature ? (
                        <div className="relative group h-14 flex items-center justify-center">
                          <img
                            src={approvedSignatureUrl}
                            alt="Approved Signature / Stamp"
                            className="h-12 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => approvedSignatureInputRef.current?.click()}
                            className="no-print absolute inset-0 bg-indigo-900/70 text-white rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity cursor-pointer font-khmer gap-1"
                          >
                            <PhotoIcon className="w-3 h-3" />
                            <span>ផ្លាស់ប្ដូរ</span>
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => approvedSignatureInputRef.current?.click()}
                          className="no-print group h-14 w-32 border border-dashed border-slate-300 hover:border-indigo-500 rounded flex flex-col items-center justify-center text-[10px] text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Click to upload stamp / approved signature"
                        >
                          <PhotoIcon className="w-4 h-4 mb-0.5" />
                          <span className="font-khmer">+ ដាក់ហត្ថលេខា/ត្រា</span>
                        </div>
                      )}
                      {approvedByName && (
                        <div className="font-bold font-khmer text-indigo-950 mt-1">
                          {approvedByName}
                        </div>
                      )}
                      <div className="w-44 border-b border-dotted border-black my-1"></div>
                      <div className="text-xs font-mono">{approvedDate}</div>
                    </div>
                  </div>
                </div>

                {/* ================= PAGE 2: CHECKIN LATE REPORT (A4 Page 2) ================= */}
                {showDetailedBreakdown && (
                  <>
                    {/* Visual Label (Page 2) in UI (hidden in print) */}
                    <div className="no-print flex items-center justify-between text-xs text-slate-400 font-semibold mt-4 px-1">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <span>📄 {locale === 'kh' ? 'ទំព័រទី ២: តារាងលម្អិត Checkin Late Report' : 'Page 2: Checkin Late Report'}</span>
                      </span>
                      <span className="text-slate-400 font-mono">A4 Size</span>
                    </div>

                    <div className="slip-page-2 slip-card-box bg-white text-black p-6 sm:p-7 rounded-xl shadow-xl border border-slate-300 font-sans relative">
                      <div>
                        {/* Secondary Logo Header matching Picture 3 */}
                        <div className="flex flex-col items-center justify-center text-center mb-5">
                          {showLogo && (
                            <img
                              src={effectiveLogo}
                              alt="Company Logo"
                              className="h-16 sm:h-20 object-contain mb-1.5"
                            />
                          )}
                          <div className="font-khmer font-bold text-amber-600 text-sm tracking-wide">
                            {projectTitleKh || 'បុរី ឃីហេង កំបូលស៊ីធី'}
                          </div>
                          <div className="font-semibold text-amber-600 text-xs tracking-wider">
                            {projectName || 'Borey KhyHeng Kambol City'}
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold text-black mt-2 font-serif tracking-tight">
                            {reportTitleEn || 'Checkin Late Report'}
                          </h3>
                          <p className="text-sm sm:text-base text-slate-800 font-bold mt-1 font-mono tracking-wide">
                            {formatShortDate(startDate)} &nbsp;&nbsp; To &nbsp;&nbsp; {formatShortDate(endDate)}
                          </p>
                        </div>

                        {/* Detailed Blue Table */}
                        <table className="slip-table w-full border-collapse border border-black text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-[#2563eb] text-white">
                              <th className="border border-black px-3 py-2 font-bold uppercase text-left w-3/12">
                                DATE
                              </th>
                              <th className="border border-black px-3 py-2 font-bold uppercase text-left w-5/12">
                                CHECK
                              </th>
                              <th className="border border-black px-3 py-2 font-bold uppercase text-center w-2/12">
                                LATE
                              </th>
                              <th className="border border-black px-3 py-2 font-bold uppercase text-left w-2/12">
                                DESCRIPTION
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.incidentList.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="border border-black px-3 py-6 text-center text-slate-500 font-khmer italic">
                                  {locale === 'kh' ? 'គ្មានទិន្នន័យមកយឺតក្នុងកាលបរិច្ឆេទនេះទេ' : 'No late attendance records for this period'}
                                </td>
                              </tr>
                            ) : (
                              data.incidentList.map((inc, iIdx) => (
                                <tr key={iIdx} className="hover:bg-slate-50">
                                  <td className="border border-black px-3 py-1.5 font-mono text-slate-900">
                                    {formatEnglishFullDate(inc.date)}
                                  </td>
                                  <td className="border border-black px-3 py-1.5 font-mono font-medium text-slate-800">
                                    {inc.shiftText}
                                  </td>
                                  <td className="border border-black px-3 py-1.5 text-center font-bold text-amber-600 font-mono">
                                    {inc.lateFormatted}
                                  </td>
                                  <td className="border border-black px-3 py-1.5 text-slate-700">
                                    {inc.description}
                                  </td>
                                </tr>
                              ))
                            )}
                            {/* Summary Row */}
                            <tr className="bg-slate-100 font-bold">
                              <td colSpan={2} className="border border-black px-3 py-2 text-right font-mono">
                                Total: <span className="text-amber-600">{data.totalLateMinutes}m</span>
                              </td>
                              <td colSpan={2} className="border border-black px-3 py-2 font-mono">
                                Count Late: <span className="text-amber-600">{data.totalLateCount}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DESIGN & SETTINGS MODAL */ }
  {
    showSettingsModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 overflow-y-auto py-8">
        <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo my-auto">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-950/90 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Cog6ToothIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-khmer">
                  {locale === 'kh' ? 'ការកំណត់ប័ណ្ណវត្តមាន & ហត្ថលេខា' : 'Slip Design & Signature Settings'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {locale === 'kh' ? 'កែប្រែហត្ថលេខា ឡូហ្គោ និងព័ត៌មានប័ណ្ណវត្តមាន' : 'Upload custom signature, company logo and header info'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Settings Tabs */}
          <div className="flex border-b border-white/10 bg-slate-950/40 px-6">
            <button
              type="button"
              onClick={() => setActiveSettingsTab('signature')}
              className={`py-3 px-4 font-semibold text-xs border-b-2 font-khmer transition-all cursor-pointer ${activeSettingsTab === 'signature'
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              ✍️ {locale === 'kh' ? 'ហត្ថលេខា & អ្នករៀបចំ' : 'Signatures & Signer'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab('header')}
              className={`py-3 px-4 font-semibold text-xs border-b-2 font-khmer transition-all cursor-pointer ${activeSettingsTab === 'header'
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              🏢 {locale === 'kh' ? 'ឡូហ្គោ & ចំណងជើង' : 'Logo & Header'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab('display')}
              className={`py-3 px-4 font-semibold text-xs border-b-2 font-khmer transition-all cursor-pointer ${activeSettingsTab === 'display'
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              ⚙️ {locale === 'kh' ? 'ជម្រើសបង្ហាញ' : 'Display Options'}
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* TAB 1: SIGNATURES */}
            {activeSettingsTab === 'signature' && (
              <div className="space-y-6">
                {/* Prepared By Signature Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3.5">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-khmer flex items-center justify-between">
                    <span>1. ហត្ថលេខាអ្នករៀបចំ (Prepared By Signature)</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPreparedSignature}
                        onChange={(e) => {
                          setShowPreparedSignature(e.target.checked);
                          saveSettingsToStorage({ showPreparedSignature: e.target.checked });
                        }}
                        className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>បង្ហាញហត្ថលេខា</span>
                    </label>
                  </h4>

                  {/* Signature Preview & Upload Box */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-40 h-20 bg-white rounded-lg p-2 border border-slate-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                      <img
                        src={effectivePreparedSignature}
                        alt="Signature Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <p className="text-xs text-slate-300 font-khmer">
                        {preparedSignatureUrl ? '✅ កំពុងប្រើហត្ថលេខាផ្ទាល់ខ្លួន' : '⚡ កំពុងប្រើហត្ថលេខាដើម'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => preparedSignatureInputRef.current?.click()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer font-khmer"
                        >
                          <PhotoIcon className="w-3.5 h-3.5" />
                          <span>{locale === 'kh' ? 'Upload រូបភាពថ្មី' : 'Upload Image'}</span>
                        </button>
                        {preparedSignatureUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreparedSignatureUrl('');
                              saveSettingsToStorage({ preparedSignatureUrl: '' });
                            }}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer font-khmer"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>{locale === 'kh' ? 'ត្រឡប់ដើម' : 'Reset'}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-khmer">
                        អនុញ្ញាតប្រភេទ PNG, JPG (ផ្ទៃថ្លា Transparent រឹតតែស្អាត)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                        ឈ្មោះអ្នករៀបចំ (Prepared By Name)
                      </label>
                      <input
                        type="text"
                        value={preparedByName}
                        onChange={(e) => {
                          setPreparedByName(e.target.value);
                          saveSettingsToStorage({ preparedByName: e.target.value });
                        }}
                        className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none font-khmer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                        កាលបរិច្ឆេទ (Prepared Date)
                      </label>
                      <input
                        type="text"
                        value={preparedDate}
                        onChange={(e) => {
                          setPreparedDate(e.target.value);
                          saveSettingsToStorage({ preparedDate: e.target.value });
                        }}
                        className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Approved By Signature / Stamp Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-khmer flex items-center justify-between">
                    <span>2. ហត្ថលេខាអ្នកយល់ព្រម / ត្រា (Approved By / Stamp)</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showApprovedSignature}
                        onChange={(e) => {
                          setShowApprovedSignature(e.target.checked);
                          saveSettingsToStorage({ showApprovedSignature: e.target.checked });
                        }}
                        className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>បង្ហាញហត្ថលេខា/ត្រា</span>
                    </label>
                  </h4>

                  {/* Approved Signature Upload */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-40 h-20 bg-white rounded-lg p-2 border border-slate-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                      {approvedSignatureUrl ? (
                        <img
                          src={approvedSignatureUrl}
                          alt="Approved Stamp"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] text-slate-400 font-khmer text-center">មិនទាន់មានត្រា/ហត្ថលេខា</span>
                      )}
                    </div>

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => approvedSignatureInputRef.current?.click()}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer font-khmer"
                        >
                          <PhotoIcon className="w-3.5 h-3.5" />
                          <span>{locale === 'kh' ? 'Upload ហត្ថលេខា/ត្រា' : 'Upload Stamp/Sign'}</span>
                        </button>
                        {approvedSignatureUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovedSignatureUrl('');
                              saveSettingsToStorage({ approvedSignatureUrl: '' });
                            }}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer font-khmer"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            <span>{locale === 'kh' ? 'លុបចេញ' : 'Remove'}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-khmer">
                        (ជាជម្រើស) អ្នកអាច upload ត្រាក្រុមហ៊ុន ឬទុកនៅទំនេរដើម្បីចុះហត្ថលេខាដោយដៃ
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                        ឈ្មោះអ្នកយល់ព្រម (Approved By Name)
                      </label>
                      <input
                        type="text"
                        value={approvedByName}
                        onChange={(e) => {
                          setApprovedByName(e.target.value);
                          saveSettingsToStorage({ approvedByName: e.target.value });
                        }}
                        placeholder="ឧ. នាយកប្រតិបត្តិ..."
                        className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none font-khmer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                        កាលបរិច្ឆេទយល់ព្រម (Approved Date Line)
                      </label>
                      <input
                        type="text"
                        value={approvedDate}
                        onChange={(e) => {
                          setApprovedDate(e.target.value);
                          saveSettingsToStorage({ approvedDate: e.target.value });
                        }}
                        className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: HEADER & BRANDING */}
            {activeSettingsTab === 'header' && (
              <div className="space-y-4">
                {/* Logo Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-khmer flex items-center justify-between">
                    <span>ឡូហ្គោក្រុមហ៊ុន / គម្រោង (Company Logo)</span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => {
                          setShowLogo(e.target.checked);
                          saveSettingsToStorage({ showLogo: e.target.checked });
                        }}
                        className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>បង្ហាញ Logo</span>
                    </label>
                  </h4>

                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-36 h-20 bg-white rounded-lg p-2 border border-slate-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                      <img
                        src={effectiveLogo}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer font-khmer"
                        >
                          <PhotoIcon className="w-3.5 h-3.5" />
                          <span>{locale === 'kh' ? 'Upload Logo ថ្មី' : 'Upload New Logo'}</span>
                        </button>
                        {customLogoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomLogoUrl('');
                              saveSettingsToStorage({ customLogoUrl: '' });
                            }}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer font-khmer"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>{locale === 'kh' ? 'ប្រើ Logo ដើម' : 'Reset Logo'}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-khmer">
                        ទំហំសមស្រប: PNG ឬ JPG ផ្ទៃថ្លា (Transparent)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Project Titles */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-khmer">
                    ចំណងជើងគម្រោង & របាយការណ៍ (Header Titles)
                  </h4>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                      ឈ្មោះគម្រោងជាភាសាខ្មែរ (Project Title Khmer)
                    </label>
                    <input
                      type="text"
                      value={projectTitleKh}
                      onChange={(e) => {
                        setProjectTitleKh(e.target.value);
                        saveSettingsToStorage({ projectTitleKh: e.target.value });
                      }}
                      className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none font-khmer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                      ឈ្មោះគម្រោងជាភាសាអង់គ្លេស (Project Name English)
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => {
                        setProjectName(e.target.value);
                        saveSettingsToStorage({ projectName: e.target.value });
                      }}
                      className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-khmer">
                      ចំណងជើងតារាងលម្អិត (Breakdown Report Title)
                    </label>
                    <input
                      type="text"
                      value={reportTitleEn}
                      onChange={(e) => {
                        setReportTitleEn(e.target.value);
                        saveSettingsToStorage({ reportTitleEn: e.target.value });
                      }}
                      className="w-full py-2 px-3 border border-white/10 bg-slate-950 text-white rounded-xl text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DISPLAY OPTIONS */}
            {activeSettingsTab === 'display' && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-khmer">
                  ជម្រើសនៃការបង្ហាញលើប័ណ្ណ (Display Options)
                </h4>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                    <span className="font-khmer">បង្ហាញតារាងលម្អិត (Checkin Late Detailed Table)</span>
                    <input
                      type="checkbox"
                      checked={showDetailedBreakdown}
                      onChange={(e) => {
                        setShowDetailedBreakdown(e.target.checked);
                        saveSettingsToStorage({ showDetailedBreakdown: e.target.checked });
                      }}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                    <span className="font-khmer">បង្ហាញឡូហ្គោក្រុមហ៊ុន (Show Company Logo)</span>
                    <input
                      type="checkbox"
                      checked={showLogo}
                      onChange={(e) => {
                        setShowLogo(e.target.checked);
                        saveSettingsToStorage({ showLogo: e.target.checked });
                      }}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                    <span className="font-khmer">បង្ហាញហត្ថលេខាអ្នករៀបចំ (Show Prepared Signature)</span>
                    <input
                      type="checkbox"
                      checked={showPreparedSignature}
                      onChange={(e) => {
                        setShowPreparedSignature(e.target.checked);
                        saveSettingsToStorage({ showPreparedSignature: e.target.checked });
                      }}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                    <span className="font-khmer">បង្ហាញហត្ថលេខា/ត្រាអ្នកយល់ព្រម (Show Approved Stamp/Sign)</span>
                    <input
                      type="checkbox"
                      checked={showApprovedSignature}
                      onChange={(e) => {
                        setShowApprovedSignature(e.target.checked);
                        saveSettingsToStorage({ showApprovedSignature: e.target.checked });
                      }}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (confirm(locale === 'kh' ? 'តើអ្នកពិតជាចង់កំណត់ឡើងវិញទាំងអស់មែនទេ?' : 'Reset all settings to default?')) {
                  localStorage.removeItem(SETTINGS_STORAGE_KEY);
                  setProjectName('Project: KH-KBC');
                  setProjectTitleKh('គម្រោង បុរីកំបូល ស៊ីធី');
                  setReportTitleEn('Checkin Late Report');
                  setPreparedByName('ឌី ច័ន្ទតារា');
                  setPreparedSignatureUrl('');
                  setShowPreparedSignature(true);
                  setApprovedByName('');
                  setApprovedDate('...../...../ 2026');
                  setApprovedSignatureUrl('');
                  setShowApprovedSignature(true);
                  setCustomLogoUrl('');
                  setShowLogo(true);
                  setShowDetailedBreakdown(true);
                }
              }}
              className="text-xs text-slate-400 hover:text-rose-400 font-khmer cursor-pointer flex items-center gap-1"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>{locale === 'kh' ? 'កំណត់លំនាំដើមទាំងអស់' : 'Reset All Defaults'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer font-khmer flex items-center gap-1.5"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{locale === 'kh' ? 'រួចរាល់ (Save & Close)' : 'Done'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
    </div >
  );
};

export default AttendanceSlip;
