import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTime12Hour } from '../utils/dateUtils';
import {
  ClockIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  UserIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// Helper to format Date into localized display string e.g. "28 August 2026 (Friday)"
const formatDisplayDate = (dateString, locale) => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString(locale === 'kh' ? 'km-KH' : 'en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (e) {
    return dateString;
  }
};

const getEmpPhoto = (emp) => {
  if (!emp) return null;
  if (emp.photoUrl) return emp.photoUrl;
  if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
  if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
  return null;
};

const AttendanceIncomplete = () => {
  const { user } = useAuth();
  const { language, t, getLocalizedName } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [companyWorkHours, setCompanyWorkHours] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const empDropdownRef = useRef(null);

  // Default: 1st day of current month to today
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

  const fetchInitialData = async () => {
    try {
      const [deptRes, empRes, whRes, leaveRes] = await Promise.all([
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/company-work-hours').catch(() => ({ data: null })),
        api.get('/leaves').catch(() => ({ data: [] })),
      ]);
      setDepartments(deptRes.data || []);
      setEmployees(empRes.data || []);
      if (whRes.data) {
        setCompanyWorkHours(whRes.data);
      }
      setLeaves(leaveRes.data || []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (user.role === 'Employee') {
        query += `&staffId=${user.staffId}`;
      } else {
        if (selectedStaffId) query += `&staffId=${selectedStaffId}`;
        if (filterDept) query += `&departmentId=${filterDept}`;
      }

      const response = await api.get(`/attendances/history${query}`);
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error loading attendance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchLogs();
  }, [startDate, endDate, selectedStaffId, filterDept]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployeesList = useMemo(() => {
    return employees.filter(emp => {
      if (!empSearchQuery || !empSearchQuery.trim()) return true;
      const q = empSearchQuery.trim().toLowerCase();
      const staffId = (emp.staffId || '').toLowerCase();
      const nameEn = (emp.nameEn || '').toLowerCase();
      const nameKh = (emp.nameKh || '').toLowerCase();
      return staffId.includes(q) || nameEn.includes(q) || nameKh.includes(q);
    });
  }, [employees, empSearchQuery]);

  // Calculate incomplete attendance records based on schedule, leaves, and scan logs
  const incompleteRecords = useMemo(() => {
    if (!startDate || !endDate || employees.length === 0) return [];

    // Parse company default working days (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun)
    let defaultWorkingDays = [1, 2, 3, 4, 5];
    if (companyWorkHours?.flexibleSchedule) {
      try {
        const parsed = typeof companyWorkHours.flexibleSchedule === 'string'
          ? JSON.parse(companyWorkHours.flexibleSchedule)
          : companyWorkHours.flexibleSchedule;
        if (Array.isArray(parsed?.workingDays)) {
          defaultWorkingDays = parsed.workingDays;
        }
      } catch (e) {}
    }

    // Build lookup maps
    // 1. Logs map: key = `${staffId}_${dateString}`
    const logsMap = new Map();
    logs.forEach(l => {
      const sId = l.employee?.staffId || l.staffId;
      const dateStr = l.attendanceDate ? new Date(l.attendanceDate).toISOString().split('T')[0] : '';
      if (sId && dateStr) {
        logsMap.set(`${sId}_${dateStr}`, l);
      }
    });

    // 2. Approved leaves map: key = `${staffId}_${dateString}` -> list of leave records
    const leavesMap = new Map();
    leaves.forEach(lv => {
      if (lv.status === 'Approved' || lv.status === 'Pending') {
        const dateStr = lv.leaveDate ? new Date(lv.leaveDate).toISOString().split('T')[0] : '';
        if (lv.staffId && dateStr) {
          const key = `${lv.staffId}_${dateStr}`;
          if (!leavesMap.has(key)) {
            leavesMap.set(key, []);
          }
          leavesMap.get(key).push(lv);
        }
      }
    });

    // Generate list of dates between startDate and endDate
    const dateList = [];
    let cur = new Date(startDate);
    const stop = new Date(endDate);
    while (cur <= stop) {
      dateList.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const results = [];

    // Target employees to evaluate
    const targetEmployees = employees.filter(emp => {
      if (user.role === 'Employee' && emp.staffId !== user.staffId) return false;
      if (selectedStaffId && emp.staffId !== selectedStaffId) return false;
      if (filterDept && String(emp.departmentId) !== String(filterDept)) return false;
      if (emp.status === 'Inactive' || emp.status === 'Resigned' || emp.status === 'Terminated') return false;
      return true;
    });

    targetEmployees.forEach(emp => {
      // Determine working days for this employee
      let empWorkingDays = defaultWorkingDays;
      let empFlexibleObj = {};
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

      // Check if employee has Shift 2 enabled
      const hasShift2 = Boolean(
        emp.shift2Start && emp.shift2End &&
        emp.shift2Start.trim() !== '' && emp.shift2End.trim() !== ''
      );

      dateList.forEach(dateStr => {
        // Check join date
        if (emp.joinDate && dateStr < emp.joinDate) return;

        // Check if date is a working day
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // Check flexible date override if any
        const dateSchedule = empFlexibleObj[dateStr];
        let isWorkingDay = empWorkingDays.includes(dayOfWeek);
        if (dateSchedule) {
          if (dateSchedule.isDayOff === true || dateSchedule.working === false) {
            isWorkingDay = false;
          } else if (dateSchedule.isWorkingDay === true || dateSchedule.working === true) {
            isWorkingDay = true;
          }
        }

        // If not a scheduled working day, skip!
        if (!isWorkingDay) return;

        // Check Leaves on this date for this employee
        const empLeaves = leavesMap.get(`${emp.staffId}_${dateStr}`) || [];
        let hasFullDayLeave = false;
        let hasMorningLeave = false;
        let hasAfternoonLeave = false;
        let leaveNote = '';

        empLeaves.forEach(lv => {
          const dur = lv.durationType || '';
          const days = Number(lv.amountDays) || 1;
          const reason = (lv.reason || '').toLowerCase();
          const typeName = lv.leaveType || 'Leave';

          if (dur === 'Full Day' || days >= 1.0 || (!dur && days >= 1.0)) {
            hasFullDayLeave = true;
            leaveNote = `${typeName} (Full Day)`;
          } else if (dur === 'Morning' || reason.includes('morning') || reason.includes('shift 1') || reason.includes('វេនទី ១')) {
            hasMorningLeave = true;
            leaveNote = `${typeName} (Morning Shift)`;
          } else if (dur === 'Afternoon' || reason.includes('afternoon') || reason.includes('shift 2') || reason.includes('វេនទី ២')) {
            hasAfternoonLeave = true;
            leaveNote = `${typeName} (Afternoon Shift)`;
          } else if (days <= 0.5) {
            // Default half-day without explicit shift -> treats as Morning leave or half-day excused
            hasMorningLeave = true;
            leaveNote = `${typeName} (Half Day)`;
          }
        });

        // If employee took full day leave, do NOT show this date at all!
        if (hasFullDayLeave) return;

        // Retrieve existing attendance log
        const log = logsMap.get(`${emp.staffId}_${dateStr}`);
        const c1 = log?.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' ? log.checkin1 : null;
        const o1 = log?.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' ? log.checkout1 : null;
        const c2 = log?.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' ? log.checkin2 : null;
        const o2 = log?.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' ? log.checkout2 : null;

        // Evaluate Missing Shifts
        const shift1Required = !hasMorningLeave;
        const shift2Required = hasShift2 && !hasAfternoonLeave;

        const missingCheckin1 = shift1Required && !c1;
        const missingCheckout1 = shift1Required && !o1;
        const missingCheckin2 = shift2Required && !c2;
        const missingCheckout2 = shift2Required && !o2;

        const isShift1Incomplete = missingCheckin1 || missingCheckout1;
        const isShift2Incomplete = missingCheckin2 || missingCheckout2;

        // If there are any missing scans
        if (isShift1Incomplete || isShift2Incomplete) {
          const missingDetails = [];
          if (missingCheckin1 && missingCheckout1 && (!shift2Required || (missingCheckin2 && missingCheckout2))) {
            missingDetails.push('No Scan / Absent (អវត្តមាន)');
          } else {
            if (missingCheckin1) missingDetails.push('Missing Check-in 1 (ខ្វះ Scan ចូល វេន១)');
            if (missingCheckout1) missingDetails.push('Missing Check-out 1 (ខ្វះ Scan ចេញ វេន១)');
            if (missingCheckin2) missingDetails.push('Missing Check-in 2 (ខ្វះ Scan ចូល វេន២)');
            if (missingCheckout2) missingDetails.push('Missing Check-out 2 (ខ្វះ Scan ចេញ វេន២)');
          }

          results.push({
            id: log?.id || `missing-${emp.staffId}-${dateStr}`,
            attendanceDate: dateStr,
            staffId: emp.staffId,
            employee: emp,
            checkin1: c1,
            checkout1: o1,
            checkin2: c2,
            checkout2: o2,
            hasMorningLeave,
            hasAfternoonLeave,
            leaveNote,
            hasShift2,
            missingCheckin1,
            missingCheckout1,
            missingCheckin2,
            missingCheckout2,
            isShift1Incomplete,
            isShift2Incomplete,
            missingDetails,
            note: log?.note || (missingDetails.length > 0 ? missingDetails.join(', ') : 'Incomplete Shifts'),
          });
        }
      });
    });

    // Sort by date descending, then by employee staffId
    results.sort((a, b) => {
      if (b.attendanceDate !== a.attendanceDate) {
        return new Date(b.attendanceDate) - new Date(a.attendanceDate);
      }
      return (a.staffId || '').localeCompare(b.staffId || '');
    });

    return results;
  }, [logs, employees, leaves, companyWorkHours, startDate, endDate, selectedStaffId, filterDept, user]);

  // Client-side search filter
  const filteredRecords = useMemo(() => {
    if (!search || !search.trim()) return incompleteRecords;
    const term = search.toLowerCase().trim();
    return incompleteRecords.filter(r => {
      const sId = (r.staffId || '').toLowerCase();
      const nameEn = (r.employee?.nameEn || '').toLowerCase();
      const nameKh = (r.employee?.nameKh || '').toLowerCase();
      const note = (r.note || '').toLowerCase();
      const missing = (r.missingDetails || []).join(' ').toLowerCase();
      return sId.includes(term) || nameEn.includes(term) || nameKh.includes(term) || note.includes(term) || missing.includes(term);
    });
  }, [incompleteRecords, search]);

  // Group records by Employee
  const groupedByEmployee = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(rec => {
      const key = rec.staffId;
      if (!groups[key]) {
        groups[key] = {
          staffId: rec.staffId,
          employee: rec.employee,
          records: [],
          countMissing: 0,
        };
      }
      groups[key].records.push(rec);
      groups[key].countMissing += 1;
    });

    return Object.values(groups);
  }, [filteredRecords]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalIncomplete = filteredRecords.length;
    const uniqueEmployees = groupedByEmployee.length;
    const shift1MissingCount = filteredRecords.filter(r => r.isShift1Incomplete).length;
    const shift2MissingCount = filteredRecords.filter(r => r.isShift2Incomplete).length;

    let missingIn1 = 0;
    let missingOut1 = 0;
    let missingIn2 = 0;
    let missingOut2 = 0;

    filteredRecords.forEach(r => {
      if (r.missingCheckin1) missingIn1 += 1;
      if (r.missingCheckout1) missingOut1 += 1;
      if (r.missingCheckin2) missingIn2 += 1;
      if (r.missingCheckout2) missingOut2 += 1;
    });

    const totalMissingScans = missingIn1 + missingOut1 + missingIn2 + missingOut2;

    return {
      totalIncomplete,
      uniqueEmployees,
      shift1MissingCount,
      shift2MissingCount,
      missingIn1,
      missingOut1,
      missingIn2,
      missingOut2,
      totalMissingScans,
    };
  }, [filteredRecords, groupedByEmployee]);

  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPaginationItems = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta) ||
        (currentPage <= 4 && i <= 5) ||
        (currentPage >= totalPages - 3 && i >= totalPages - 4)
      ) {
        range.push(i);
      }
    }

    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    for (let i of uniqueRange) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const startDisplay = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Start';
    const endDisplay = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'End';
    const title = `Incomplete Shift Attendance Report (${startDisplay} to ${endDisplay})`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          body { font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; }
          .title-row { font-size: 14pt; font-weight: bold; text-align: center; height: 35px; }
          table.kpi-table { border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin-bottom: 20px; }
          table.kpi-table th { border: 1px solid #94a3b8; background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; padding: 8px 10px; font-size: 10pt; }
          table.kpi-table td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11pt; text-align: center; font-weight: bold; }
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; }
          table.report-table th { border: 1px solid #000000; background-color: #f3f4f6; font-weight: bold; text-align: left; padding: 6px 10px; font-size: 10pt; }
          table.report-table td { border: 1px solid #000000; padding: 6px 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <!-- Title Banner -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
          <tr>
            <td colspan="14" class="title-row">${title}</td>
          </tr>
          <tr>
            <td colspan="14" style="text-align:center; font-size:9pt; color:#64748b; height:20px;">
              Exported on: ${new Date().toLocaleString()}
            </td>
          </tr>
        </table>

        <!-- Summary KPI Statistics Boxes -->
        <table class="kpi-table" border="1">
          <thead>
            <tr>
              <th style="background-color:#1e293b; color:#ffffff;">TOTAL INCOMPLETE</th>
              <th style="background-color:#1e293b; color:#ffffff;">EMPLOYEES AFFECTED</th>
              <th style="background-color:#1e293b; color:#ffffff;">SHIFT 1 INCOMPLETE</th>
              <th style="background-color:#1e293b; color:#ffffff;">SHIFT 2 INCOMPLETE</th>
              <th style="background-color:#1e293b; color:#ffffff;">TOTAL MISSING SCANS</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color:#ffffff;">
              <td style="color:#e11d48; font-size:14pt;">${stats.totalIncomplete}</td>
              <td style="color:#4f46e5; font-size:14pt;">${stats.uniqueEmployees}</td>
              <td style="color:#d97706; font-size:14pt;">${stats.shift1MissingCount}</td>
              <td style="color:#7c3aed; font-size:14pt;">${stats.shift2MissingCount}</td>
              <td style="color:#dc2626; font-size:14pt;">${stats.totalMissingScans}</td>
            </tr>
            <tr style="background-color:#f8fafc; font-size:9pt; color:#64748b;">
              <td>Missing log instances</td>
              <td>Distinct staff members</td>
              <td>Morning shift missing</td>
              <td>Afternoon shift missing</td>
              <td>In: ${stats.missingIn1 + stats.missingIn2} | Out: ${stats.missingOut1 + stats.missingOut2}</td>
            </tr>
          </tbody>
        </table>

        <br/>

        <!-- Detailed Records Table -->
        <table class="report-table" border="1">
          <thead>
            <tr>
              <th>No.</th>
              <th>Date</th>
              <th>Staff ID</th>
              <th>Employee Name (EN)</th>
              <th>Employee Name (KH)</th>
              <th>Role</th>
              <th>Department</th>
              <th>Position</th>
              <th>Check-in 1</th>
              <th>Check-out 1</th>
              <th>Check-in 2</th>
              <th>Check-out 2</th>
              <th>Status</th>
              <th>Note / Description</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredRecords.forEach((rec, idx) => {
      const emp = rec.employee || {};
      const deptObj = emp.department;
      const posObj = emp.position;
      const deptName = deptObj ? (typeof deptObj === 'string' ? deptObj : (deptObj.nameEn || '')) : '';
      const posTitle = posObj ? (typeof posObj === 'string' ? posObj : (posObj.titleEn || '')) : '';
      const role = emp.role || '';

      const isNoScan = rec.missingCheckin1 && rec.missingCheckout1 && (!rec.hasShift2 || (rec.missingCheckin2 && rec.missingCheckout2));
      const statusLabel = isNoScan ? 'No Scan (Absent)' : 'Incomplete Shift';
      const details = (rec.missingDetails || []).join(', ') || rec.note || '';

      excelHTML += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${rec.attendanceDate ? new Date(rec.attendanceDate).toLocaleDateString() : '-'}</td>
          <td style="font-weight:bold;">${rec.staffId}</td>
          <td>${emp.nameEn || ''}</td>
          <td>${emp.nameKh || ''}</td>
          <td>${role}</td>
          <td>${deptName}</td>
          <td>${posTitle}</td>
          <td>${rec.hasMorningLeave ? 'Leave (Excused)' : (rec.checkin1 ? formatTime12Hour(rec.checkin1) : 'MISSING')}</td>
          <td>${rec.hasMorningLeave ? 'Leave (Excused)' : (rec.checkout1 ? formatTime12Hour(rec.checkout1) : 'MISSING')}</td>
          <td>${!rec.hasShift2 ? '-' : (rec.hasAfternoonLeave ? 'Leave (Excused)' : (rec.checkin2 ? formatTime12Hour(rec.checkin2) : 'MISSING'))}</td>
          <td>${!rec.hasShift2 ? '-' : (rec.hasAfternoonLeave ? 'Leave (Excused)' : (rec.checkout2 ? formatTime12Hour(rec.checkout2) : 'MISSING'))}</td>
          <td>${statusLabel}</td>
          <td>${details}</td>
        </tr>
      `;
    });

    excelHTML += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Incomplete_Shifts_Report_${startDate}_to_${endDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 rounded-2xl shadow-inner">
            <ExclamationTriangleIcon className="h-7 w-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {language === 'kh' ? 'វត្តមានស្កេនមិនគ្រប់វេន (Incomplete Shifts)' : 'Incomplete Shift Logs'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {language === 'kh'
                ? 'បង្ហាញទិន្នន័យបុគ្គលិកដែលស្កេនមិនគ្រប់វេនតាមថ្ងៃធ្វើការ (មិនរាប់បញ្ចូលថ្ងៃដែលបានសុំច្បាប់)'
                : 'Track missing and incomplete shift check-ins/outs based on scheduled work days and approved leaves'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            onClick={handlePrint}
            className="py-2.5 px-4 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <ClockIcon className="h-4 w-4" />
            <span>{t('printPdf') || 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'កំណត់ត្រាខ្វះសរុប' : 'Total Incomplete'}
              </p>
              <p className="text-2xl font-black text-rose-400 mt-1 font-mono">
                {stats.totalIncomplete}
              </p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-khmer">
            {language === 'kh' ? 'ថ្ងៃខ្វះការ Scan ក្នុងចន្លោះពេលនេះ' : 'Missing log instances'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'ចំនួនបុគ្គលិក' : 'Employees Affected'}
              </p>
              <p className="text-2xl font-black text-indigo-400 mt-1 font-mono">
                {stats.uniqueEmployees}
              </p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <UserIcon className="h-6 w-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-khmer">
            {language === 'kh' ? 'បុគ្គលិកដែលមានការស្កេនមិនគ្រប់' : 'Distinct staff members'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'ខ្វះវេនទី ១' : 'Shift 1 Incomplete'}
              </p>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {stats.shift1MissingCount}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-khmer">
            {language === 'kh' ? 'ខ្វះ Scan ចូល ឬចេញ វេនព្រឹក' : 'Morning shift missing'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'ខ្វះវេនទី ២' : 'Shift 2 Incomplete'}
              </p>
              <p className="text-2xl font-black text-purple-400 mt-1 font-mono">
                {stats.shift2MissingCount}
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <SparklesIcon className="h-6 w-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-khmer">
            {language === 'kh' ? 'ខ្វះ Scan ចូល ឬចេញ វេនរសៀល' : 'Afternoon shift missing'}
          </p>
        </div>

        {/* 5th Box: Total Missing Scans (Individual check-in & out missed count) */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'ចំនួនដងខ្វះ Scan សរុប' : 'Total Missing Scans'}
              </p>
              <p className="text-2xl font-black text-red-400 mt-1 font-mono">
                {stats.totalMissingScans}
              </p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
              <XCircleIcon className="h-6 w-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-khmer font-mono">
            {language === 'kh'
              ? `In: ${stats.missingIn1 + stats.missingIn2} | Out: ${stats.missingOut1 + stats.missingOut2}`
              : `In: ${stats.missingIn1 + stats.missingIn2} | Out: ${stats.missingOut1 + stats.missingOut2}`}
          </p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Filters */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>

        {/* HR/Admin Filter */}
        {user.role !== 'Employee' ? (
          <>
            {/* Employee Searchable Select Dropdown */}
            <div className="space-y-1 relative" ref={empDropdownRef}>
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                {t('employees')}
              </label>

              {/* Trigger Button */}
              <div
                onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                style={{ backgroundColor: '#FFFFFF', borderColor: isEmpDropdownOpen ? '#2D60FF' : '#CBD5E1' }}
                className={`w-full py-2 px-3 border rounded-xl text-sm flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                  isEmpDropdownOpen ? 'ring-2 ring-blue-500/20' : 'hover:border-slate-400'
                }`}
              >
                <span
                  style={{ color: selectedStaffId ? '#000000' : '#475569' }}
                  className={`truncate text-xs ${selectedStaffId ? 'font-bold' : 'font-medium'}`}
                >
                  {selectedStaffId ? (
                    (() => {
                      const emp = employees.find(e => e.staffId === selectedStaffId);
                      return emp ? `${emp.nameEn?.toUpperCase() || emp.nameKh} | ${emp.staffId}` : selectedStaffId;
                    })()
                  ) : (
                    'Select Employee'
                  )}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  {selectedStaffId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStaffId('');
                      }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 cursor-pointer bg-transparent border-none outline-none"
                      title="Clear selection"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isEmpDropdownOpen ? (
                    <ChevronUpIcon className="h-4 w-4 text-slate-600 stroke-[2.5]" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-slate-600 stroke-[2.5]" />
                  )}
                </div>
              </div>

              {/* Dropdown Menu Panel */}
              {isEmpDropdownOpen && (
                <div
                  style={{ backgroundColor: '#FFFFFF', zIndex: 100 }}
                  className="absolute left-0 right-0 top-full mt-1 border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
                >
                  <div className="p-2 border-b border-slate-100 bg-slate-50">
                    <div className="relative">
                      <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={empSearchQuery}
                        onChange={(e) => setEmpSearchQuery(e.target.value)}
                        placeholder="Search employee..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-black placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                    <div
                      onClick={() => {
                        setSelectedStaffId('');
                        setIsEmpDropdownOpen(false);
                      }}
                      style={{ color: '#000000' }}
                      className="py-2.5 px-3 text-xs cursor-pointer hover:!bg-blue-50 hover:!text-[#2D60FF] transition-colors font-medium flex items-center justify-between"
                    >
                      <span>-- {t('all')} Employees --</span>
                      {!selectedStaffId && <span className="text-blue-600 font-bold text-xs">✓</span>}
                    </div>

                    {filteredEmployeesList.map(emp => {
                      const isSelected = selectedStaffId === emp.staffId;
                      const label = `${emp.nameEn?.toUpperCase() || emp.nameKh} | ${emp.staffId}`;
                      return (
                        <div
                          key={emp.id || emp.staffId}
                          onClick={() => {
                            setSelectedStaffId(emp.staffId);
                            setIsEmpDropdownOpen(false);
                          }}
                          style={{
                            color: isSelected ? '#FFFFFF' : '#000000',
                            backgroundColor: isSelected ? '#2D60FF' : 'transparent',
                          }}
                          className={`py-2.5 px-3 text-xs cursor-pointer transition-colors flex items-center justify-between font-semibold ${
                            isSelected ? 'font-bold' : 'hover:!bg-blue-50 hover:!text-[#2D60FF]'
                          }`}
                        >
                          <span className="truncate">{label}</span>
                          {isSelected && <span className="text-white font-bold text-xs">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Department Filter */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                {t('departments')}
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
              >
                <option value="">{t('selectDept')} ({t('all')})</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900">{getLocalizedName(d.nameEn, d.nameKh)}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="md:col-span-2 flex items-center justify-end p-4 bg-slate-950/40 border border-white/5 rounded-xl text-xs font-medium text-slate-400 font-khmer">
            🔍 កំពុងបង្ហាញកំណត់ត្រាសម្រាប់គណនីរបស់អ្នកផ្ទាល់ ({user.staffId})
          </div>
        )}
      </div>

      {/* Incomplete Shift Records Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <h2 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងកំណត់ត្រាខ្វះ Scan តាមថ្ងៃធ្វើការ' : 'Incomplete Shift Log Records'}
            </h2>
          </div>
          <div className="relative w-64">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t('loading')}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircleIcon className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-emerald-400 font-khmer">
              {language === 'kh' ? 'គ្មានទិន្នន័យស្កេនមិនគ្រប់វេនឡើយ!' : 'No Incomplete Shift Records!'}
            </p>
            <p className="text-xs text-slate-400 font-khmer">
              {language === 'kh'
                ? 'បុគ្គលិកទាំងអស់បានស្កេនគ្រប់វេន ឬបានសុំច្បាប់ត្រឹមត្រូវក្នុងចន្លោះកាលបរិច្ឆេទនេះ'
                : 'All employees completed all scheduled shifts or had approved leaves for this period.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-4 px-4 font-khmer whitespace-nowrap text-center">No.</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('date')}</th>
                  <th className="py-4 px-6 font-khmer">{t('employees')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkin1')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkout1')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkin2')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkout2')}</th>
                  <th className="py-4 px-6 font-khmer min-w-[280px]">Missing Status / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedRecords.map((rec, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const emp = rec.employee || {};
                  const photo = getEmpPhoto(emp);
                  const nameEn = emp.nameEn || '';
                  const nameKh = emp.nameKh || '';
                  const displayName = getLocalizedName(nameEn, nameKh) || rec.staffId;
                  const deptName = emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '';
                  const posTitle = emp.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '';

                  return (
                    <tr key={rec.id || index} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-mono text-center text-slate-400 font-bold whitespace-nowrap">
                        {rowNumber}
                      </td>
                      <td className="py-4 px-6 font-semibold text-white whitespace-nowrap">
                        {formatDisplayDate(rec.attendanceDate, language)}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {/* Profile Avatar */}
                          {photo ? (
                            <img
                              src={photo}
                              alt={nameEn || 'avatar'}
                              className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                              {nameEn?.charAt(0)?.toUpperCase() || nameKh?.charAt(0) || rec.staffId?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white whitespace-nowrap">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-400 font-mono whitespace-nowrap">
                              ID: <span className="text-indigo-400 font-semibold">{rec.staffId}</span>{emp.role ? ` • ${emp.role}` : ''}
                            </p>
                            {(deptName || posTitle) && (
                              <p className="text-xs font-semibold text-indigo-400 whitespace-nowrap">
                                {[deptName, posTitle].filter(Boolean).join(' • ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Shift 1 In */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {rec.hasMorningLeave ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-khmer">
                            🏖️ Leave
                          </span>
                        ) : rec.checkin1 ? (
                          <span className="font-medium text-emerald-400 font-mono">{formatTime12Hour(rec.checkin1)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            MISSING
                          </span>
                        )}
                      </td>

                      {/* Shift 1 Out */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {rec.hasMorningLeave ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-khmer">
                            🏖️ Leave
                          </span>
                        ) : rec.checkout1 ? (
                          <span className="font-medium text-emerald-400 font-mono">{formatTime12Hour(rec.checkout1)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            MISSING
                          </span>
                        )}
                      </td>

                      {/* Shift 2 In */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {!rec.hasShift2 ? (
                          <span className="text-slate-500 font-mono text-xs">-</span>
                        ) : rec.hasAfternoonLeave ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-khmer">
                            🏖️ Leave
                          </span>
                        ) : rec.checkin2 ? (
                          <span className="font-medium text-emerald-400 font-mono">{formatTime12Hour(rec.checkin2)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            MISSING
                          </span>
                        )}
                      </td>

                      {/* Shift 2 Out */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {!rec.hasShift2 ? (
                          <span className="text-slate-500 font-mono text-xs">-</span>
                        ) : rec.hasAfternoonLeave ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-khmer">
                            🏖️ Leave
                          </span>
                        ) : rec.checkout2 ? (
                          <span className="font-medium text-emerald-400 font-mono">{formatTime12Hour(rec.checkout2)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            MISSING
                          </span>
                        )}
                      </td>

                      {/* Missing Status Badge */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {rec.missingDetails.map((det, dIdx) => (
                            <div key={dIdx} className="inline-block mr-1.5 mb-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 font-khmer">
                                ⚠️ {det}
                              </span>
                            </div>
                          ))}
                          {rec.leaveNote && (
                            <div className="text-[11px] text-purple-400 font-khmer">
                              🏖️ {rec.leaveNote}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalRecords > 0 && (
          <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-slate-400 font-khmer">
              Total : <span className="font-bold text-white font-mono">{totalRecords}</span> records
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
              {/* Prev Button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 min-w-[32px] px-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                &lsaquo;
              </button>

              {/* Page Number Buttons */}
              {getPaginationItems().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`dots-${idx}`} className="h-8 min-w-[32px] flex items-center justify-center text-slate-500 font-mono">
                      ...
                    </span>
                  );
                }
                const isCurrent = item === currentPage;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                        : 'border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 min-w-[32px] px-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceIncomplete;
