import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  DocumentArrowDownIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ChartBarIcon,
  Bars3BottomLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  InformationCircleIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { formatTime12Hour, formatDateDDMMYYYY } from '../utils/dateUtils';

// Helper to convert HH:mm or HH:mm:ss to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '-' || timeStr === '--:--') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// Helper to format minutes into h:mn format (e.g. 1h:30mn, 0h:45mn, 0h:00mn)
const formatHMn = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0h:00mn';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h:${String(m).padStart(2, '0')}mn`;
};

const Reports = () => {
  const { language, t, getLocalizedName } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [companyWorkHours, setCompanyWorkHours] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selected Metric Tab for Department Comparison: 'late' | 'earlyOut' | 'earlyIn' | 'incomplete' | 'all'
  const [selectedMetric, setSelectedMetric] = useState('late');

  // Chart Orientation: 'vertical' (បញ្ឈរ) | 'horizontal' (ផ្ដេក)
  const [chartOrientation, setChartOrientation] = useState('vertical');

  // Compare Mode for Rankings / Chart: 'count' (ចំនួនដង) | 'hours' (គិតជាម៉ោង)
  const [compareMode, setCompareMode] = useState('count');

  // Pagination for detailed logs table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filters State
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
  const [filterLogType, setFilterLogType] = useState('all'); // 'all' | 'onTime' | 'late' | 'earlyOut' | 'earlyIn' | 'incomplete'

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
      console.error('Error loading initial data:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (filterDept) query += `&departmentId=${filterDept}`;
      if (filterBranch) query += `&branch=${filterBranch}`;

      const response = await api.get(`/attendances/history${query}`);
      const validLogs = (response.data || []).filter(log =>
        Boolean(log.checkin1 || log.checkout1 || log.checkin2 || log.checkout2)
      );
      setLogs(validLogs);
    } catch (error) {
      console.error('Error fetching reports logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchReports();
  }, [startDate, endDate, filterDept, filterBranch]);

  // Employee photo helper
  const getEmployeePhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  // 1. Process each log with status flags directly matching Attendance Dropdown pages
  const processedLogs = useMemo(() => {
    const defaultS1Start = companyWorkHours?.shift1Start || '08:00';
    const defaultS2Start = companyWorkHours?.shift2Start || '13:00';
    const defaultS1End = companyWorkHours?.shift1End || '12:00';
    const defaultS2End = companyWorkHours?.shift2End || '17:00';
    const grace = Number(companyWorkHours?.lateGraceMinutes) || 0;

    return logs.map(log => {
      const emp = employees.find(e => e.staffId === (log.employee?.staffId || log.staffId)) || log.employee || {};

      const s1StartStr = (emp.shift1Start && emp.shift1Start.trim() !== '') ? emp.shift1Start : defaultS1Start;
      const s2StartStr = (emp.shift2Start && emp.shift2Start.trim() !== '') ? emp.shift2Start : defaultS2Start;
      const s1EndStr = (emp.shift1End && emp.shift1End.trim() !== '') ? emp.shift1End : defaultS1End;
      const s2EndStr = (emp.shift2End && emp.shift2End.trim() !== '') ? emp.shift2End : defaultS2End;

      const s1StartMin = timeToMinutes(s1StartStr) ?? 480;
      const s2StartMin = timeToMinutes(s2StartStr) ?? 780;
      const s1EndMin = timeToMinutes(s1EndStr) ?? 720;
      const s2EndMin = timeToMinutes(s2EndStr) ?? 1020;

      const c1 = log.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' && log.checkin1.trim() !== '' ? log.checkin1 : null;
      const c2 = log.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' && log.checkin2.trim() !== '' ? log.checkin2 : null;
      const o1 = log.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' && log.checkout1.trim() !== '' ? log.checkout1 : null;
      const o2 = log.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' && log.checkout2.trim() !== '' ? log.checkout2 : null;

      const c1Min = timeToMinutes(c1);
      const c2Min = timeToMinutes(c2);
      const o1Min = timeToMinutes(o1);
      const o2Min = timeToMinutes(o2);

      // Late: Exactly matches AttendanceLate page (log.isLate)
      const isLate = Boolean(log.isLate);
      const s1GraceThreshold = s1StartMin + grace;
      const s2GraceThreshold = s2StartMin + grace;
      let late1 = 0;
      let late2 = 0;
      if (c1Min !== null && c1Min > s1GraceThreshold) late1 = c1Min - s1StartMin;
      if (c2Min !== null && c2Min > s2GraceThreshold) late2 = c2Min - s2StartMin;
      let lateMinutes = (log.lateMinutes !== undefined && Number(log.lateMinutes) > 0) ? Number(log.lateMinutes) : (late1 + late2);
      if (lateMinutes === 0 && isLate) lateMinutes = 1;

      // Early Out: Exactly matches AttendanceEarlyOut page (log.isEarlyLeave)
      const isEarlyOut = Boolean(log.isEarlyLeave);
      let earlyOut1 = 0;
      let earlyOut2 = 0;
      if (o1Min !== null && o1Min < s1EndMin) earlyOut1 = s1EndMin - o1Min;
      if (o2Min !== null && o2Min < s2EndMin) earlyOut2 = s2EndMin - o2Min;
      let earlyOutMinutes = (log.earlyOutMinutes !== undefined && Number(log.earlyOutMinutes) > 0) ? Number(log.earlyOutMinutes) : (earlyOut1 + earlyOut2);
      if (earlyOutMinutes === 0 && isEarlyOut) earlyOutMinutes = 1;

      // Early In: Exactly matches AttendanceEarlyIn page
      let earlyIn1 = 0;
      let earlyIn2 = 0;
      if (c1Min !== null && c1Min < s1StartMin) earlyIn1 = s1StartMin - c1Min;
      if (c2Min !== null && c2Min < s2StartMin) earlyIn2 = s2StartMin - c2Min;
      let earlyInMinutes = (log.earlyInMinutes !== undefined && Number(log.earlyInMinutes) > 0) ? Number(log.earlyInMinutes) : (earlyIn1 + earlyIn2);
      const isEarlyIn = earlyInMinutes > 0;

      // On Time: Not late and not early out
      const isOnTime = !isLate && !isEarlyOut;

      const deptId = emp.departmentId || emp.department?.id || log.employee?.departmentId || log.employee?.department?.id;

      return {
        ...log,
        _emp: emp,
        _deptId: deptId,
        _isLate: isLate,
        _isEarlyOut: isEarlyOut,
        _isEarlyIn: isEarlyIn,
        _isOnTime: isOnTime,
        _lateMinutes: isLate ? lateMinutes : 0,
        _earlyOutMinutes: isEarlyOut ? earlyOutMinutes : 0,
        _earlyInMinutes: isEarlyIn ? earlyInMinutes : 0,
      };
    });
  }, [logs, employees, companyWorkHours]);

  // 2. Incomplete Shifts records - calculated exactly identical to AttendanceIncomplete.jsx
  const incompleteRecords = useMemo(() => {
    if (!startDate || !endDate || employees.length === 0) return [];

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

    const logsMap = new Map();
    logs.forEach(l => {
      const sId = l.employee?.staffId || l.staffId;
      const dateStr = l.attendanceDate ? new Date(l.attendanceDate).toISOString().split('T')[0] : '';
      if (sId && dateStr) {
        logsMap.set(`${sId}_${dateStr}`, l);
      }
    });

    // 2. Approved and Pending leaves map: key = `${staffId}_${dateString}` -> list of leave records
    const leavesMap = new Map();
    leaves.forEach(lv => {
      const st = (lv.status || '').toLowerCase();
      if (st === 'approved' || st === 'pending') {
        const rawDate = lv.leaveDate || lv.startDate || '';
        let dateStr = '';
        if (typeof rawDate === 'string') {
          dateStr = rawDate.split('T')[0];
        } else if (rawDate) {
          dateStr = new Date(rawDate).toISOString().split('T')[0];
        }
        if (lv.staffId && dateStr) {
          const key = `${lv.staffId}_${dateStr}`;
          if (!leavesMap.has(key)) leavesMap.set(key, []);
          leavesMap.get(key).push(lv);
        }
      }
    });

    // Local today string (YYYY-MM-DD)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const dateList = [];
    let cur = new Date(startDate);
    const stop = new Date(endDate);
    while (cur <= stop) {
      dateList.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const results = [];

    const targetEmployees = employees.filter(emp => {
      if (filterDept && String(emp.departmentId) !== String(filterDept)) return false;
      if (filterBranch && emp.branch !== filterBranch) return false;
      if (emp.status === 'Inactive' || emp.status === 'Resigned' || emp.status === 'Terminated') return false;
      return true;
    });

    targetEmployees.forEach(emp => {
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

      dateList.forEach(dateStr => {
        if (emp.joinDate && dateStr < emp.joinDate) return;

        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();

        const dateSchedule = empFlexibleObj[dateStr];
        let isWorkingDay = empWorkingDays.includes(dayOfWeek);
        if (dateSchedule) {
          if (dateSchedule.isDayOff === true || dateSchedule.working === false) {
            isWorkingDay = false;
          } else if (dateSchedule.isWorkingDay === true || dateSchedule.working === true) {
            isWorkingDay = true;
          }
        }

        const log = logsMap.get(`${emp.staffId}_${dateStr}`);
        const c1 = log?.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' && log.checkin1.trim() !== '' ? log.checkin1 : null;
        const o1 = log?.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' && log.checkout1.trim() !== '' ? log.checkout1 : null;
        const c2 = log?.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' && log.checkin2.trim() !== '' ? log.checkin2 : null;
        const o2 = log?.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' && log.checkout2.trim() !== '' ? log.checkout2 : null;
        const hasAnyScan = Boolean(c1 || o1 || c2 || o2);

        const s2Start = emp.shift2Start || companyWorkHours?.shift2Start;
        const s2End = emp.shift2End || companyWorkHours?.shift2End;
        const hasShift2 = Boolean(
          (s2Start && s2End && s2Start.trim() !== '' && s2End.trim() !== '') ||
          c2 || o2
        );

        if (!isWorkingDay && !hasAnyScan) return;

        const empLeaves = leavesMap.get(`${emp.staffId}_${dateStr}`) || [];
        const isToday = dateStr === todayStr;
        const hasLeaveRecord = empLeaves.length > 0 || (log?.note && log.note.toLowerCase().includes('leave'));

        // If employee took leave on today, do NOT count into incomplete!
        if (isToday && hasLeaveRecord) return;

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
            hasMorningLeave = true;
            leaveNote = `${typeName} (Half Day)`;
          }
        });

        if (hasFullDayLeave && !hasAnyScan) return;

        const shift1Required = (!hasMorningLeave) || Boolean(c1 || o1);
        const shift2Required = (hasShift2 && !hasAfternoonLeave) || Boolean(c2 || o2);

        const missingCheckin1 = shift1Required && !c1;
        const missingCheckout1 = shift1Required && !o1;
        const missingCheckin2 = shift2Required && !c2;
        const missingCheckout2 = shift2Required && !o2;

        const isShift1Incomplete = missingCheckin1 || missingCheckout1;
        const isShift2Incomplete = missingCheckin2 || missingCheckout2;

        if (isShift1Incomplete || isShift2Incomplete) {
          const missingDetails = [];
          if (missingCheckin1 && missingCheckout1 && (!shift2Required || (missingCheckin2 && missingCheckout2))) {
            missingDetails.push('No Scan / Absent (អវត្តមាន)');
          } else {
            if (missingCheckin1) missingDetails.push('Missing Check-in 1');
            if (missingCheckout1) missingDetails.push('Missing Check-out 1');
            if (missingCheckin2) missingDetails.push('Missing Check-in 2');
            if (missingCheckout2) missingDetails.push('Missing Check-out 2');
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
            missingDetails,
            isShift1Incomplete,
            isShift2Incomplete,
            departmentId: emp.departmentId,
            _isLate: false,
            _isEarlyOut: false,
            _isEarlyIn: false,
            _isIncomplete: true,
            _isOnTime: false,
            _emp: emp,
            _deptId: emp.departmentId,
            note: log?.note || (missingDetails.length > 0 ? missingDetails.join(', ') : 'Incomplete Shifts'),
          });
        }
      });
    });

    return results;
  }, [logs, employees, leaves, companyWorkHours, startDate, endDate, filterDept, filterBranch]);

  // 3. Calculate Department Breakdown
  const departmentStats = useMemo(() => {
    if (departments.length === 0) return [];

    return departments.map(dept => {
      const deptEmployees = employees.filter(e => {
        if (String(e.departmentId) !== String(dept.id)) return false;
        if (filterBranch && e.branch !== filterBranch) return false;
        if (e.status === 'Inactive' || e.status === 'Resigned' || e.status === 'Terminated') return false;
        return true;
      });

      // Filter processed logs that belong to this department
      const deptLogs = processedLogs.filter(log => {
        const emp = log._emp || {};
        const matchesDept = String(log._deptId) === String(dept.id) ||
                            String(emp.departmentId) === String(dept.id) ||
                            String(emp.department?.id) === String(dept.id);
        if (!matchesDept) return false;
        if (filterBranch && emp.branch !== filterBranch) return false;
        return true;
      });

      const lateCount = deptLogs.filter(l => l._isLate).length;
      const earlyOutCount = deptLogs.filter(l => l._isEarlyOut).length;
      const earlyInCount = deptLogs.filter(l => l._isEarlyIn).length;
      const onTimeCount = deptLogs.filter(l => l._isOnTime).length;
      const totalLogsCount = deptLogs.length;

      // Incomplete count matching AttendanceIncomplete.jsx exactly
      const incompleteScanCount = incompleteRecords.filter(r =>
        String(r.departmentId || r.employee?.departmentId) === String(dept.id)
      ).length;

      // Duration in minutes
      const lateMinutes = deptLogs.filter(l => l._isLate).reduce((acc, l) => acc + (l._lateMinutes || 0), 0);
      const earlyOutMinutes = deptLogs.filter(l => l._isEarlyOut).reduce((acc, l) => acc + (l._earlyOutMinutes || 0), 0);
      const earlyInMinutes = deptLogs.filter(l => l._isEarlyIn).reduce((acc, l) => acc + (l._earlyInMinutes || 0), 0);
      const totalDurationMinutes = lateMinutes + earlyOutMinutes + earlyInMinutes;

      return {
        id: dept.id,
        nameEn: dept.nameEn,
        nameKh: dept.nameKh,
        displayName: getLocalizedName(dept.nameEn, dept.nameKh),
        employeeCount: deptEmployees.length,
        lateCount,
        earlyOutCount,
        earlyInCount,
        incompleteScanCount,
        onTimeCount,
        totalLogsCount,
        totalIncidents: lateCount + earlyOutCount + earlyInCount + incompleteScanCount,
        lateMinutes,
        earlyOutMinutes,
        earlyInMinutes,
        totalDurationMinutes,
      };
    });
  }, [departments, employees, processedLogs, incompleteRecords, filterBranch, language, getLocalizedName]);

  // Overall Totals directly matching Attendance Log sub-pages
  const totals = useMemo(() => {
    const totalLate = processedLogs.filter(l => l._isLate).length;
    const totalEarlyOut = processedLogs.filter(l => l._isEarlyOut).length;
    const totalEarlyIn = processedLogs.filter(l => l._isEarlyIn).length;
    const totalIncomplete = incompleteRecords.length;
    const totalLogs = processedLogs.length;
    const totalOnTime = processedLogs.filter(l => l._isOnTime).length;

    const totalLateMinutes = departmentStats.reduce((acc, d) => acc + (d.lateMinutes || 0), 0);
    const totalEarlyOutMinutes = departmentStats.reduce((acc, d) => acc + (d.earlyOutMinutes || 0), 0);
    const totalEarlyInMinutes = departmentStats.reduce((acc, d) => acc + (d.earlyInMinutes || 0), 0);
    const totalDurationMinutes = totalLateMinutes + totalEarlyOutMinutes + totalEarlyInMinutes;

    return {
      totalLate,
      totalEarlyOut,
      totalEarlyIn,
      totalIncomplete,
      totalLogs,
      totalOnTime,
      totalLateMinutes,
      totalEarlyOutMinutes,
      totalEarlyInMinutes,
      totalDurationMinutes,
    };
  }, [processedLogs, incompleteRecords, departmentStats]);

  // 2. Metric Config & Ranking (supports both 'count' and 'hours' compareMode)
  const metricConfigs = {
    late: {
      key: compareMode === 'hours' ? 'lateMinutes' : 'lateCount',
      titleEn: compareMode === 'hours' ? 'Late Duration (មកយឺត)' : 'Late Arrivals (មកយឺត)',
      titleKh: compareMode === 'hours' ? 'រយៈពេលមកយឺត (Late Duration)' : 'បុគ្គលិកមកយឺត (Late Arrivals)',
      color: '#f59e0b',
      bgLight: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      barGradient: 'from-amber-600 to-amber-400',
      totalValue: compareMode === 'hours' ? totals.totalLateMinutes : totals.totalLate,
      displayTotal: compareMode === 'hours' ? formatHMn(totals.totalLateMinutes) : `${totals.totalLate} ${language === 'kh' ? 'ដង' : 'times'}`,
      formatValue: (val) => compareMode === 'hours' ? formatHMn(val) : `${val} ${language === 'kh' ? 'ដង' : 'times'}`,
      unit: compareMode === 'hours' ? '' : (language === 'kh' ? 'ដង' : 'times'),
    },
    earlyOut: {
      key: compareMode === 'hours' ? 'earlyOutMinutes' : 'earlyOutCount',
      titleEn: compareMode === 'hours' ? 'Early Out Duration (ចេញមុន)' : 'Early Out (ចេញមុន)',
      titleKh: compareMode === 'hours' ? 'រយៈពេលចេញមុនម៉ោង (Early Out Duration)' : 'បុគ្គលិកចេញមុនម៉ោង (Early Out)',
      color: '#f43f5e',
      bgLight: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      barGradient: 'from-rose-600 to-rose-400',
      totalValue: compareMode === 'hours' ? totals.totalEarlyOutMinutes : totals.totalEarlyOut,
      displayTotal: compareMode === 'hours' ? formatHMn(totals.totalEarlyOutMinutes) : `${totals.totalEarlyOut} ${language === 'kh' ? 'ដង' : 'times'}`,
      formatValue: (val) => compareMode === 'hours' ? formatHMn(val) : `${val} ${language === 'kh' ? 'ដង' : 'times'}`,
      unit: compareMode === 'hours' ? '' : (language === 'kh' ? 'ដង' : 'times'),
    },
    earlyIn: {
      key: compareMode === 'hours' ? 'earlyInMinutes' : 'earlyInCount',
      titleEn: compareMode === 'hours' ? 'Early In Duration (មកមុន)' : 'Early In (មកមុន)',
      titleKh: compareMode === 'hours' ? 'រយៈពេលមកមុនម៉ោង (Early In Duration)' : 'បុគ្គលិកមកមុនម៉ោង (Early In)',
      color: '#10b981',
      bgLight: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      barGradient: 'from-emerald-600 to-emerald-400',
      totalValue: compareMode === 'hours' ? totals.totalEarlyInMinutes : totals.totalEarlyIn,
      displayTotal: compareMode === 'hours' ? formatHMn(totals.totalEarlyInMinutes) : `${totals.totalEarlyIn} ${language === 'kh' ? 'ដង' : 'times'}`,
      formatValue: (val) => compareMode === 'hours' ? formatHMn(val) : `${val} ${language === 'kh' ? 'ដង' : 'times'}`,
      unit: compareMode === 'hours' ? '' : (language === 'kh' ? 'ដង' : 'times'),
    },
    incomplete: {
      key: 'incompleteScanCount',
      titleEn: 'Incomplete Scans (ស្កេនមិនគ្រប់)',
      titleKh: 'ស្កេនមិនគ្រប់វេន (Incomplete Scans)',
      color: '#8b5cf6',
      bgLight: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      barGradient: 'from-purple-600 to-purple-400',
      totalValue: totals.totalIncomplete,
      displayTotal: `${totals.totalIncomplete} ${language === 'kh' ? 'ដង' : 'times'}`,
      formatValue: (val) => `${val} ${language === 'kh' ? 'ដង' : 'times'}`,
      unit: language === 'kh' ? 'ដង' : 'times',
    },
    all: {
      key: compareMode === 'hours' ? 'totalDurationMinutes' : 'totalIncidents',
      titleEn: compareMode === 'hours' ? 'Total Combined Duration (រយៈពេលសរុប)' : 'All Metrics Combined (ប្រៀបធៀបទាំងអស់)',
      titleKh: compareMode === 'hours' ? 'រយៈពេលសរុបគ្រប់ទិន្នន័យ (Total Duration)' : 'ប្រៀបធៀបគ្រប់ទិន្នន័យ (All Metrics)',
      color: '#6366f1',
      bgLight: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-400',
      barGradient: 'from-indigo-600 to-purple-500',
      totalValue: compareMode === 'hours' ? totals.totalDurationMinutes : (totals.totalLate + totals.totalEarlyOut + totals.totalEarlyIn + totals.totalIncomplete),
      displayTotal: compareMode === 'hours' ? formatHMn(totals.totalDurationMinutes) : `${totals.totalLate + totals.totalEarlyOut + totals.totalEarlyIn + totals.totalIncomplete} ${language === 'kh' ? 'ករណី' : 'incidents'}`,
      formatValue: (val) => compareMode === 'hours' ? formatHMn(val) : `${val} ${language === 'kh' ? 'ករណី' : 'incidents'}`,
      unit: compareMode === 'hours' ? '' : (language === 'kh' ? 'ករណី' : 'incidents'),
    },
  };

  const currentMetricConfig = metricConfigs[selectedMetric] || metricConfigs.late;

  // Sorted departments based on selected metric
  const sortedBySelectedMetric = useMemo(() => {
    const key = currentMetricConfig.key;
    return [...departmentStats].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  }, [departmentStats, currentMetricConfig]);

  // Max value for scaling
  const maxSelectedValue = useMemo(() => {
    const key = currentMetricConfig.key;
    let max = 1;
    departmentStats.forEach(d => {
      if ((d[key] || 0) > max) max = d[key];
    });
    return Math.max(max, 5);
  }, [departmentStats, currentMetricConfig]);

  // Dynamic max ceiling and grid ticks for vertical column chart
  const chartMax = useMemo(() => {
    const maxVal = maxSelectedValue || 5;
    if (compareMode === 'hours') {
      if (maxVal <= 60) return 60;
      if (maxVal <= 120) return 120;
      if (maxVal <= 300) return 300;
      if (maxVal <= 600) return 600;
      if (maxVal <= 1200) return 1200;
      return Math.ceil(maxVal / 240) * 240;
    }
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    if (maxVal <= 20) return 20;
    if (maxVal <= 50) return Math.ceil(maxVal / 10) * 10;
    return Math.ceil(maxVal / 20) * 20;
  }, [maxSelectedValue, compareMode]);

  const gridTicks = useMemo(() => {
    const step = chartMax / 4;
    return [chartMax, Math.round(step * 3), Math.round(step * 2), Math.round(step), 0];
  }, [chartMax]);

  // Categorize Highest, Medium/Moderate, Lowest/Best
  const rankingAnalysis = useMemo(() => {
    if (sortedBySelectedMetric.length === 0) return null;
    const highest = sortedBySelectedMetric[0];
    const lowest = sortedBySelectedMetric[sortedBySelectedMetric.length - 1];

    let medium = null;
    if (sortedBySelectedMetric.length > 2) {
      const midIdx = Math.floor(sortedBySelectedMetric.length / 2);
      medium = sortedBySelectedMetric[midIdx];
    } else if (sortedBySelectedMetric.length === 2) {
      medium = sortedBySelectedMetric[1];
    }

    return { highest, medium, lowest };
  }, [sortedBySelectedMetric]);

  // Filtered Logs for Detailed Table based on filterLogType
  const filteredDisplayLogs = useMemo(() => {
    if (filterLogType === 'incomplete') {
      return incompleteRecords;
    }
    return processedLogs.filter(log => {
      if (filterLogType === 'late') return log._isLate;
      if (filterLogType === 'earlyOut') return log._isEarlyOut;
      if (filterLogType === 'earlyIn') return log._isEarlyIn;
      if (filterLogType === 'onTime') return log._isOnTime;
      return true;
    });
  }, [processedLogs, incompleteRecords, filterLogType]);

  // Pagination for Detailed Logs Table
  const totalRecords = filteredDisplayLogs.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedLogs = filteredDisplayLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  // Export to Excel with department comparison and detailed logs
  const handleExportExcel = () => {
    if (logs.length === 0) return;

    const startDisplay = startDate ? formatDateDDMMYYYY(startDate) : 'Start';
    const endDisplay = endDate ? formatDateDDMMYYYY(endDate) : 'End';
    const title = `Attendance Department Comparison Analytics (${startDisplay} to ${endDisplay})`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          body { font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; }
          .title-row { font-size: 14pt; font-weight: bold; text-align: center; height: 35px; }
          .section-title { font-size: 12pt; font-weight: bold; color: #1e293b; height: 30px; }
          table.kpi-table { border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin-bottom: 20px; }
          table.kpi-table th { border: 1px solid #94a3b8; background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; padding: 8px 10px; font-size: 10pt; }
          table.kpi-table td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11pt; text-align: center; font-weight: bold; }
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; margin-bottom: 25px; }
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

        <!-- Overall KPI Statistics -->
        <table class="kpi-table" border="1">
          <thead>
            <tr>
              <th>TOTAL LOGS</th>
              <th>ON TIME</th>
              <th>LATE ARRIVALS</th>
              <th>EARLY OUT</th>
              <th>EARLY IN</th>
              <th>INCOMPLETE SCANS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="color:#2563eb;">${totals.totalLogs}</td>
              <td style="color:#059669;">${totals.totalOnTime}</td>
              <td style="color:#d97706;">${totals.totalLate}</td>
              <td style="color:#e11d48;">${totals.totalEarlyOut}</td>
              <td style="color:#10b981;">${totals.totalEarlyIn}</td>
              <td style="color:#7c3aed;">${totals.totalIncomplete}</td>
            </tr>
          </tbody>
        </table>

        <!-- Department Comparison Table -->
        <div class="section-title">📊 DEPARTMENT COMPARISON BREAKDOWN</div>
        <table class="report-table" border="1">
          <thead>
            <tr style="background-color:#e2e8f0;">
              <th>Department Name</th>
              <th>Staff Count</th>
              <th>Late (មកយឺត)</th>
              <th>Early Out (ចេញមុន)</th>
              <th>Early In (មកមុន)</th>
              <th>Incomplete Scans (ស្កេនមិនគ្រប់)</th>
              <th>Total Incidents</th>
            </tr>
          </thead>
          <tbody>
    `;

    departmentStats.forEach(d => {
      excelHTML += `
        <tr>
          <td style="font-weight:bold;">${d.nameEn} (${d.nameKh})</td>
          <td style="text-align:center;">${d.employeeCount}</td>
          <td style="text-align:center; color:#d97706; font-weight:bold;">${d.lateCount}</td>
          <td style="text-align:center; color:#e11d48; font-weight:bold;">${d.earlyOutCount}</td>
          <td style="text-align:center; color:#10b981; font-weight:bold;">${d.earlyInCount}</td>
          <td style="text-align:center; color:#7c3aed; font-weight:bold;">${d.incompleteScanCount}</td>
          <td style="text-align:center; font-weight:bold;">${d.totalIncidents}</td>
        </tr>
      `;
    });

    excelHTML += `
          </tbody>
        </table>

        <!-- Department Duration Table (h:mn) -->
        <div class="section-title">⏱️ DEPARTMENT METRICS DURATION BREAKDOWN (h:mn)</div>
        <table class="report-table" border="1">
          <thead>
            <tr style="background-color:#fef3c7;">
              <th>Department Name</th>
              <th>Staff Count</th>
              <th>Late Duration (មកយឺត)</th>
              <th>Early Out Duration (ចេញមុន)</th>
              <th>Early In Duration (មកមុន)</th>
            </tr>
          </thead>
          <tbody>
    `;

    departmentStats.forEach(d => {
      excelHTML += `
        <tr>
          <td style="font-weight:bold;">${d.nameEn} (${d.nameKh})</td>
          <td style="text-align:center;">${d.employeeCount}</td>
          <td style="text-align:center; color:#d97706; font-weight:bold;">${formatHMn(d.lateMinutes)}</td>
          <td style="text-align:center; color:#e11d48; font-weight:bold;">${formatHMn(d.earlyOutMinutes)}</td>
          <td style="text-align:center; color:#10b981; font-weight:bold;">${formatHMn(d.earlyInMinutes)}</td>
        </tr>
      `;
    });

    excelHTML += `
          </tbody>
          <tfoot>
            <tr style="background-color:#f1f5f9; font-weight:bold;">
              <td>TOTAL</td>
              <td style="text-align:center;">${departmentStats.reduce((acc, d) => acc + (d.employeeCount || 0), 0)}</td>
              <td style="text-align:center; color:#d97706;">${formatHMn(totals.totalLateMinutes)}</td>
              <td style="text-align:center; color:#e11d48;">${formatHMn(totals.totalEarlyOutMinutes)}</td>
              <td style="text-align:center; color:#10b981;">${formatHMn(totals.totalEarlyInMinutes)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Detailed Attendance Table -->
        <div class="section-title">📋 DETAILED ATTENDANCE LOGS</div>
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
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
    `;

    processedLogs.forEach((log, idx) => {
      const emp = log._emp || log.employee || {};
      const dept = emp.department ? (emp.department.nameEn || '') : '';
      const pos = emp.position ? (emp.position.titleEn || '') : '';

      const statusList = [];
      if (log._isLate) statusList.push('Late');
      if (log._isEarlyOut) statusList.push('Early Leave');
      if (log._isEarlyIn) statusList.push('Early In');
      if (log._isIncomplete) statusList.push('Incomplete');
      if (log._isOnTime) statusList.push('On Time');
      const status = statusList.join(', ') || 'Normal';

      excelHTML += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${formatDateDDMMYYYY(log.attendanceDate)}</td>
          <td style="font-weight:bold;">${emp.staffId || log.staffId || '-'}</td>
          <td>${emp.nameEn || ''}</td>
          <td>${emp.nameKh || ''}</td>
          <td>${emp.role || ''}</td>
          <td>${dept}</td>
          <td>${pos}</td>
          <td>${log.checkin1 ? formatTime12Hour(log.checkin1) : '-'}</td>
          <td>${log.checkout1 ? formatTime12Hour(log.checkout1) : '-'}</td>
          <td>${log.checkin2 ? formatTime12Hour(log.checkin2) : '-'}</td>
          <td>${log.checkout2 ? formatTime12Hour(log.checkout2) : '-'}</td>
          <td>${status}</td>
          <td>${log.note || ''}</td>
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
    link.setAttribute('download', `Department_Comparison_Report_${startDate}_to_${endDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Title Header */}
      <div className="glass-card p-6 rounded-2xl glow-indigo flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
            <ChartBarIcon className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {language === 'kh' ? 'របាយការណ៍ & ក្រាហ្វិកប្រៀបធៀបដេប៉ាតឺម៉ង់' : 'Reports & Department Analytics'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {language === 'kh'
                ? 'ប្រៀបធៀបដេប៉ាតឺម៉ង់ណាមាន មកយឺត (Late), ចេញមុន (Early Out), មកមុន (Early In), និង ស្កេនមិនគ្រប់ (Incomplete) ច្រើនជាងគេ មធ្យម ឬតិចជាងគេ'
                : 'Compare which departments have the Highest, Medium, or Lowest Late, Early Out, Early In, and Incomplete scans'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            onClick={handlePrint}
            className="py-2.5 px-4 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>{t('printPdf') || 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Department / Branch / Log Type Strip */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 no-print">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('fromDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('toDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('departments')}</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
          >
            <option value="" className="bg-slate-900">{t('departments')} ({t('all')})</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id} className="bg-slate-900">
                {getLocalizedName(dept.nameEn, dept.nameKh)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('branch')}</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
          >
            <option value="" className="bg-slate-900">{t('branch')} ({t('all')})</option>
            <option value="Phnom Penh HQ" className="bg-slate-900">Phnom Penh HQ</option>
            <option value="Siem Reap Branch" className="bg-slate-900">Siem Reap Branch</option>
            <option value="Battambang Branch" className="bg-slate-900">Battambang Branch</option>
            <option value="Sihanoukville Branch" className="bg-slate-900">Sihanoukville Branch</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
            {language === 'kh' ? 'កំណត់ត្រាវត្តមាន (Log Type)' : 'Attendance Log'}
          </label>
          <select
            value={filterLogType}
            onChange={(e) => {
              const val = e.target.value;
              setFilterLogType(val);
              setCurrentPage(1);
              if (val === 'late') setSelectedMetric('late');
              else if (val === 'earlyOut') setSelectedMetric('earlyOut');
              else if (val === 'earlyIn') setSelectedMetric('earlyIn');
              else if (val === 'incomplete') setSelectedMetric('incomplete');
              else setSelectedMetric('all');
            }}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
          >
            <option value="all" className="bg-slate-900">{language === 'kh' ? 'All Logs (កំណត់ត្រាទាំងអស់)' : 'All Attendance Logs'}</option>
            <option value="onTime" className="bg-slate-900">{language === 'kh' ? 'On Time (ទាន់ពេល)' : 'On Time / Normal'}</option>
            <option value="late" className="bg-slate-900">{language === 'kh' ? 'Late (មកយឺត)' : 'Late Arrivals'}</option>
            <option value="earlyOut" className="bg-slate-900">{language === 'kh' ? 'Early Out (ចេញមុន)' : 'Early Departures'}</option>
            <option value="earlyIn" className="bg-slate-900">{language === 'kh' ? 'Early In (មកមុន)' : 'Early Arrivals'}</option>
            <option value="incomplete" className="bg-slate-900">{language === 'kh' ? 'Incomplete (មិនគ្រប់)' : 'Incomplete Shifts'}</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => {
            setFilterLogType('all');
            setSelectedMetric('all');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'all' ? 'border-indigo-500/80 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50' : 'border-white/5 hover:border-indigo-500/30'
          }`}
        >
          <span className="block text-[11px] text-slate-400 font-semibold uppercase font-khmer">Total Logs</span>
          <span className="block text-xl font-bold mt-1 text-white font-mono">{totals.totalLogs}</span>
        </div>
        <div
          onClick={() => {
            setFilterLogType('onTime');
            setSelectedMetric('all');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'onTime' ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' : 'border-white/5 hover:border-emerald-500/30'
          }`}
        >
          <span className="block text-[11px] text-emerald-400 font-semibold uppercase font-khmer">{t('normal')}</span>
          <span className="block text-xl font-bold mt-1 text-emerald-400 font-mono">{totals.totalOnTime}</span>
        </div>
        <div
          onClick={() => {
            setFilterLogType('late');
            setSelectedMetric('late');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'late' || selectedMetric === 'late' ? 'border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50' : 'border-white/5 hover:border-amber-500/30'
          }`}
        >
          <span className="block text-[11px] text-amber-400 font-semibold uppercase font-khmer">Late (មកយឺត)</span>
          <span className="block text-xl font-bold mt-1 text-amber-400 font-mono">{totals.totalLate}</span>
        </div>
        <div
          onClick={() => {
            setFilterLogType('earlyOut');
            setSelectedMetric('earlyOut');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'earlyOut' || selectedMetric === 'earlyOut' ? 'border-rose-500/80 bg-rose-500/10 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/50' : 'border-white/5 hover:border-rose-500/30'
          }`}
        >
          <span className="block text-[11px] text-rose-400 font-semibold uppercase font-khmer">Early Out (ចេញមុន)</span>
          <span className="block text-xl font-bold mt-1 text-rose-400 font-mono">{totals.totalEarlyOut}</span>
        </div>
        <div
          onClick={() => {
            setFilterLogType('earlyIn');
            setSelectedMetric('earlyIn');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'earlyIn' || selectedMetric === 'earlyIn' ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' : 'border-white/5 hover:border-emerald-500/30'
          }`}
        >
          <span className="block text-[11px] text-emerald-400 font-semibold uppercase font-khmer">Early In (មកមុន)</span>
          <span className="block text-xl font-bold mt-1 text-emerald-400 font-mono">{totals.totalEarlyIn}</span>
        </div>
        <div
          onClick={() => {
            setFilterLogType('incomplete');
            setSelectedMetric('incomplete');
            setCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterLogType === 'incomplete' || selectedMetric === 'incomplete' ? 'border-purple-500/80 bg-purple-500/10 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/50' : 'border-white/5 hover:border-purple-500/30'
          }`}
        >
          <span className="block text-[11px] text-purple-400 font-semibold uppercase font-khmer">Incomplete (មិនគ្រប់)</span>
          <span className="block text-xl font-bold mt-1 text-purple-400 font-mono">{totals.totalIncomplete}</span>
        </div>
      </div>

      {/* 2. Interactive Metric Comparison & Department Ranking Hub */}
      <div className="glass-card rounded-3xl overflow-hidden border border-white/10 p-6 space-y-6">
        {/* Metric Selector Tab Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <h2 className="text-base sm:text-lg font-bold text-white font-khmer">
                {language === 'kh' ? 'ការប្រៀបធៀបដេប៉ាតឺម៉ង់តាមកម្រិត (Department Comparison Ranking)' : 'Department Metric Comparison & Ranking'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-khmer mt-1">
              {language === 'kh'
                ? 'ជ្រើសរើសប្រភេទ Metric ខាងក្រោមដើម្បីមើលថាដេប៉ាតឺម៉ង់ណាមានចំនួន ច្រើនជាងគេ (Highest), មធ្យម (Medium), ឬ តិចជាងគេ (Lowest)'
                : 'Select a metric tab to analyze which departments rank Highest, Medium/Average, or Lowest'}
            </p>
          </div>

          {/* Metric Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setSelectedMetric('late')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all font-khmer cursor-pointer flex items-center gap-1.5 ${
                selectedMetric === 'late'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              <span>Late (មកយឺត)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMetric('earlyOut')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all font-khmer cursor-pointer flex items-center gap-1.5 ${
                selectedMetric === 'earlyOut'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 font-black'
                  : 'text-slate-400 hover:text-rose-300 hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span>Early Out (ចេញមុន)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMetric('earlyIn')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all font-khmer cursor-pointer flex items-center gap-1.5 ${
                selectedMetric === 'earlyIn'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span>Early In (មកមុន)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMetric('incomplete')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all font-khmer cursor-pointer flex items-center gap-1.5 ${
                selectedMetric === 'incomplete'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30 font-black'
                  : 'text-slate-400 hover:text-purple-300 hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              <span>Incomplete (ស្កេនមិនគ្រប់)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMetric('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all font-khmer cursor-pointer flex items-center gap-1.5 ${
                selectedMetric === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
              <span>All Combined (សរុបទាំងអស់)</span>
            </button>
          </div>
        </div>

        {/* Tier Ranking Highlight Cards (Highest, Medium, Lowest) */}
        {rankingAnalysis && selectedMetric !== 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. HIGHEST / ច្រើនជាងគេ */}
            <div className="bg-gradient-to-br from-rose-950/40 to-slate-900/90 border border-rose-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 w-20 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 font-khmer flex items-center gap-1">
                  🚨 {language === 'kh' ? 'ច្រើនជាងគេ (Highest)' : 'Highest Ranked'}
                </span>
                <span className="text-xl">🥇</span>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-bold text-white font-khmer truncate">
                  {rankingAnalysis.highest.displayName}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black font-mono text-rose-400">
                    {currentMetricConfig.formatValue(rankingAnalysis.highest[currentMetricConfig.key])}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    ({currentMetricConfig.totalValue > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalValue) * 100) : 0}% នៃសរុប)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.highest.employeeCount} នាក់ • មធ្យម: {compareMode === 'hours' ? formatHMn(rankingAnalysis.highest[currentMetricConfig.key] / Math.max(rankingAnalysis.highest.employeeCount, 1)) : `${(rankingAnalysis.highest[currentMetricConfig.key] / Math.max(rankingAnalysis.highest.employeeCount, 1)).toFixed(1)} ${currentMetricConfig.unit}`}/នាក់
                </p>
              </div>
            </div>

            {/* 2. MEDIUM / កម្រិតមធ្យម */}
            <div className="bg-gradient-to-br from-amber-950/30 to-slate-900/90 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 font-khmer flex items-center gap-1">
                  ⚖️ {language === 'kh' ? 'កម្រិតមធ្យម (Moderate)' : 'Moderate / Medium'}
                </span>
                <span className="text-xl">🥈</span>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-bold text-white font-khmer truncate">
                  {rankingAnalysis.medium ? rankingAnalysis.medium.displayName : '-'}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {rankingAnalysis.medium ? currentMetricConfig.formatValue(rankingAnalysis.medium[currentMetricConfig.key]) : '0'}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    ({rankingAnalysis.medium && currentMetricConfig.totalValue > 0 ? Math.round((rankingAnalysis.medium[currentMetricConfig.key] / currentMetricConfig.totalValue) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.medium ? rankingAnalysis.medium.employeeCount : 0} នាក់ • មធ្យម: {rankingAnalysis.medium ? (compareMode === 'hours' ? formatHMn(rankingAnalysis.medium[currentMetricConfig.key] / Math.max(rankingAnalysis.medium.employeeCount, 1)) : `${(rankingAnalysis.medium[currentMetricConfig.key] / Math.max(rankingAnalysis.medium.employeeCount, 1)).toFixed(1)} ${currentMetricConfig.unit}`) : 0}/នាក់
                </p>
              </div>
            </div>

            {/* 3. LOWEST / BEST COMPLIANCE / តិចជាងគេ */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-khmer flex items-center gap-1">
                  🏆 {language === 'kh' ? 'តិចជាងគេ / ល្អបំផុត (Lowest)' : 'Lowest / Best Compliance'}
                </span>
                <span className="text-xl">🎖️</span>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-bold text-white font-khmer truncate">
                  {rankingAnalysis.lowest.displayName}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {currentMetricConfig.formatValue(rankingAnalysis.lowest[currentMetricConfig.key])}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    ({currentMetricConfig.totalValue > 0 ? Math.round((rankingAnalysis.lowest[currentMetricConfig.key] / currentMetricConfig.totalValue) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.lowest.employeeCount} នាក់ • មធ្យម: {compareMode === 'hours' ? formatHMn(rankingAnalysis.lowest[currentMetricConfig.key] / Math.max(rankingAnalysis.lowest.employeeCount, 1)) : `${(rankingAnalysis.lowest[currentMetricConfig.key] / Math.max(rankingAnalysis.lowest.employeeCount, 1)).toFixed(1)} ${currentMetricConfig.unit}`}/នាក់
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Smart AI-like Summary Insights Banner */}
        {rankingAnalysis && selectedMetric !== 'all' && (
          <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl flex-shrink-0 mt-0.5">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white font-khmer">
                {language === 'kh' ? 'សេចក្តីសង្ខេបនៃការវិភាគប្រៀបធៀប (Comparative Insight):' : 'Comparative Analytics Insight:'}
              </p>
              <p className="text-slate-300 font-khmer leading-relaxed">
                {language === 'kh' ? (
                  <>
                    ដេប៉ាតឺម៉ង់ដែលមាន{compareMode === 'hours' ? 'រយៈពេល' : 'ចំនួន'} <span className={`font-bold ${currentMetricConfig.text}`}>{currentMetricConfig.titleKh}</span> <strong>ច្រើនជាងគេ</strong> គឺ <span className="text-white font-bold">{rankingAnalysis.highest.displayName}</span> (<strong>{currentMetricConfig.formatValue(rankingAnalysis.highest[currentMetricConfig.key])}</strong>, ស្មើនឹង {currentMetricConfig.totalValue > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalValue) * 100) : 0}%)។
                    {rankingAnalysis.medium && (
                      <> ចំណែកដេប៉ាតឺម៉ង់ <strong>កម្រិតមធ្យម</strong> គឺ <span className="text-white font-bold">{rankingAnalysis.medium.displayName}</span> (<strong>{currentMetricConfig.formatValue(rankingAnalysis.medium[currentMetricConfig.key])}</strong>)។</>
                    )}
                    {` ហើយដេប៉ាតឺម៉ង់ដែលមាន `}
                    <strong>{compareMode === 'hours' ? 'រយៈពេលតិចជាងគេ' : 'ចំនួនតិចជាងគេបំផុត'}</strong> គឺ <span className="text-emerald-400 font-bold">{rankingAnalysis.lowest.displayName}</span> (<strong>{currentMetricConfig.formatValue(rankingAnalysis.lowest[currentMetricConfig.key])}</strong>)។
                  </>
                ) : (
                  <>
                    The department with the <strong>Highest</strong> {currentMetricConfig.titleEn} is <span className="text-white font-bold">{rankingAnalysis.highest.displayName}</span> ({currentMetricConfig.formatValue(rankingAnalysis.highest[currentMetricConfig.key])}, {currentMetricConfig.totalValue > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalValue) * 100) : 0}%).
                    {rankingAnalysis.medium && (
                      <> The <strong>Moderate/Medium</strong> department is <span className="text-white font-bold">{rankingAnalysis.medium.displayName}</span> ({currentMetricConfig.formatValue(rankingAnalysis.medium[currentMetricConfig.key])}).</>
                    )}
                    {` Meanwhile, the department with the `}
                    <strong>Lowest</strong> {currentMetricConfig.titleEn} is <span className="text-emerald-400 font-bold">{rankingAnalysis.lowest.displayName}</span> ({currentMetricConfig.formatValue(rankingAnalysis.lowest[currentMetricConfig.key])}).
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Comparative Department Rankings Section (Selectable: Vertical Chart vs Horizontal Bars) */}
        {selectedMetric !== 'all' ? (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold text-slate-300 font-khmer uppercase tracking-wider">
                  {language === 'kh' ? `ចំណាត់ថ្នាក់ប្រៀបធៀបតាមដេប៉ាតឺម៉ង់ (${currentMetricConfig.titleKh})` : `Department Rankings for ${currentMetricConfig.titleEn}`}
                </h3>
                <span className="text-slate-400 font-mono text-[11px] bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/5 font-bold">
                  Total: {currentMetricConfig.displayTotal}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Compare Mode Selector: Count vs Hours */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCompareMode('count')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-khmer cursor-pointer ${
                      compareMode === 'count'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={language === 'kh' ? 'ប្រៀបធៀបតាមចំនួនដង (Count)' : 'Compare by Count (Times)'}
                  >
                    <span>🔢</span>
                    <span>{language === 'kh' ? 'ចំនួនដង (Count)' : 'By Count'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompareMode('hours')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-khmer cursor-pointer ${
                      compareMode === 'hours'
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/30 ring-1 ring-amber-400/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={language === 'kh' ? 'ប្រៀបធៀបគិតជាម៉ោង (Duration / h:mn)' : 'Compare by Hours (Duration)'}
                  >
                    <ClockIcon className="w-3.5 h-3.5 text-white" />
                    <span>{language === 'kh' ? 'គិតជាម៉ោង (Hours)' : 'By Hours'}</span>
                  </button>
                </div>

                {/* Chart Mode Selector: Vertical (បញ្ឈរ) vs Horizontal (ផ្ដេក) */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setChartOrientation('vertical')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-khmer cursor-pointer ${
                      chartOrientation === 'vertical'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={language === 'kh' ? 'បង្ហាញជាក្រាហ្វបញ្ឈរ' : 'Switch to Vertical Column Chart'}
                  >
                    <ChartBarIcon className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'បញ្ឈរ' : 'Vertical'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChartOrientation('horizontal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-khmer cursor-pointer ${
                      chartOrientation === 'horizontal'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={language === 'kh' ? 'បង្ហាញជាក្រាហ្វផ្ដេក' : 'Switch to Horizontal Bars'}
                  >
                    <Bars3BottomLeftIcon className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'ផ្ដេក' : 'Horizontal'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View 1: ក្រាហ្វបញ្ឈរ (Vertical Column Chart) */}
            {chartOrientation === 'vertical' ? (
              <div className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/5 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xs">
                <div className="w-full overflow-x-auto pb-8 pt-2">
                  <div className="min-w-[550px] h-88 relative flex items-end justify-around px-6 pt-10 pb-28 mb-4 border-b border-l border-slate-300 dark:border-white/20">
                    {/* Background horizontal grid lines with values */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pl-6 pr-2 pb-28 pt-10">
                      {gridTicks.map((val, idx) => (
                        <div key={idx} className="w-full flex items-center gap-2 text-[11px] font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                          <span className="w-14 text-right font-bold truncate">
                            {compareMode === 'hours' ? formatHMn(val) : val}
                          </span>
                          <div className="flex-1 h-px bg-slate-200 dark:bg-white/15"></div>
                        </div>
                      ))}
                    </div>

                    {/* Columns for each department */}
                    {sortedBySelectedMetric.map((dept, index) => {
                      const count = dept[currentMetricConfig.key] || 0;
                      const heightPercent = chartMax > 0 ? (count / chartMax) * 100 : 0;
                      const totalPct = currentMetricConfig.totalValue > 0 ? Math.round((count / currentMetricConfig.totalValue) * 100) : 0;

                      let tierBadge = {
                        labelKh: 'កម្រិតទាប (Low)',
                        labelEn: 'Low',
                        badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/30'
                      };
                      let rankColor = 'bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-200';

                      if (index === 0) {
                        tierBadge = {
                          labelKh: 'ច្រើនជាងគេ (Highest)',
                          labelEn: 'Highest',
                          badgeBg: 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-400 dark:border-rose-500/30'
                        };
                        rankColor = 'bg-rose-500 text-white shadow-sm shadow-rose-500/40';
                      } else if (index === 1 || (index > 0 && index < sortedBySelectedMetric.length - 1)) {
                        tierBadge = {
                          labelKh: 'កម្រិតមធ្យម (Medium)',
                          labelEn: 'Medium',
                          badgeBg: 'bg-amber-100 dark:bg-amber-500/25 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-500/30'
                        };
                        rankColor = 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30';
                      }

                      return (
                        <div key={dept.id || index} className="flex-1 flex flex-col items-center justify-end h-full relative z-10 px-2 group">
                          {/* Floating values and rank badge above column */}
                          <div className="flex flex-col items-center mb-2 transition-transform duration-200 group-hover:-translate-y-1">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] mb-1 ${rankColor}`}>
                              {index + 1}
                            </span>
                            <span className={`text-sm sm:text-base font-black font-mono leading-none ${currentMetricConfig.text}`}>
                              {currentMetricConfig.formatValue(count)}
                            </span>
                            <span className="text-[11px] font-bold font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              ({totalPct}%)
                            </span>
                          </div>

                          {/* Vertical Bar Column */}
                          <div className="w-12 sm:w-16 h-full flex items-end justify-center">
                            <div
                              style={{ height: `${Math.max(heightPercent, 4)}%` }}
                              className={`w-full rounded-t-2xl bg-gradient-to-t ${currentMetricConfig.barGradient} transition-all duration-500 group-hover:brightness-125 shadow-lg relative overflow-hidden`}
                            >
                              <div className="absolute inset-x-0 top-0 h-1 bg-white/30 rounded-t-2xl"></div>
                            </div>
                          </div>

                          {/* Bottom Labeling: Name, Staff Count, and Tier */}
                          <div className="absolute top-full left-0 right-0 pt-2 text-center flex flex-col items-center px-1">
                            <p 
                              className="text-xs sm:text-sm font-black font-khmer line-clamp-2 leading-snug tracking-tight" 
                              title={dept.displayName}
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {dept.displayName}
                            </p>
                            <p 
                              className="text-[11px] font-bold font-mono mt-1"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {dept.employeeCount} {language === 'kh' ? 'បុគ្គលិក' : 'Staff'}
                            </p>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-khmer mt-1 inline-block ${tierBadge.badgeBg}`}>
                              {language === 'kh' ? tierBadge.labelKh : tierBadge.labelEn}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* View 2: ក្រាហ្វផ្ដេក (Horizontal Comparative Ranking Bars) */
              <div className="space-y-3">
                {sortedBySelectedMetric.map((dept, index) => {
                  const count = dept[currentMetricConfig.key] || 0;
                  const percentage = maxSelectedValue > 0 ? (count / maxSelectedValue) * 100 : 0;
                  const totalPct = currentMetricConfig.totalValue > 0 ? Math.round((count / currentMetricConfig.totalValue) * 100) : 0;

                  let tierBadge = {
                    labelKh: 'កម្រិតទាប (Low)',
                    labelEn: 'Low',
                    badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/30'
                  };

                  if (index === 0) {
                    tierBadge = {
                      labelKh: 'ច្រើនជាងគេ (Highest)',
                      labelEn: 'Highest',
                      badgeBg: 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-400 dark:border-rose-500/30'
                    };
                  } else if (index === 1 || (index > 0 && index < sortedBySelectedMetric.length - 1)) {
                    tierBadge = {
                      labelKh: 'កម្រិតមធ្យម (Medium)',
                      labelEn: 'Medium',
                      badgeBg: 'bg-amber-100 dark:bg-amber-500/25 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-500/30'
                    };
                  }

                  return (
                    <div
                      key={dept.id || index}
                      className="bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 rounded-2xl p-4 transition-all duration-200 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                            index === 0 ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/40' : (index === 1 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-200')
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <span 
                              className="font-black font-khmer text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {dept.displayName}
                            </span>
                            <span 
                              className="text-xs font-mono ml-2 font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              ({dept.employeeCount} Staff)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-khmer ${tierBadge.badgeBg}`}>
                            {language === 'kh' ? tierBadge.labelKh : tierBadge.labelEn}
                          </span>
                          <div className="text-right">
                            <span className={`text-base font-black font-mono ${currentMetricConfig.text}`}>
                              {currentMetricConfig.formatValue(count)}
                            </span>
                            <span 
                              className="text-xs font-mono ml-1.5 font-bold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              ({totalPct}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                          className={`h-full rounded-full bg-gradient-to-r ${currentMetricConfig.barGradient} transition-all duration-500 shadow-sm`}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* When 'All Combined' is active, show the 4-column Grouped Comparison View */
          <div className="space-y-6 pt-2">
            <h3 className="text-xs font-bold text-slate-300 font-khmer uppercase tracking-wider">
              {language === 'kh' ? 'តារាងក្រាហ្វិកប្រៀបធៀបគ្រប់ទិន្នន័យតាមដេប៉ាតឺម៉ង់' : 'Side-by-Side Department Comparison for All Metrics'}
            </h3>

            <div className="w-full overflow-x-auto pt-2 pb-4">
              <div className="min-w-[650px] h-72 relative flex items-end justify-between px-6 pt-6 pb-12 border-b border-l border-white/10">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pl-6 pr-2 pb-12 pt-6">
                  {[20, 15, 10, 5, 0].map((val, idx) => (
                    <div key={idx} className="w-full flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span className="w-6 text-right">{val}</span>
                      <div className="flex-1 h-px bg-white/5"></div>
                    </div>
                  ))}
                </div>

                {departmentStats.map((dept, dIdx) => (
                  <div key={dept.id || dIdx} className="flex-1 flex flex-col items-center justify-end h-full relative z-10 px-2 group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      {/* Late */}
                      <div className="w-3.5 sm:w-4 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-amber-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {dept.lateCount}
                        </span>
                        <div style={{ height: `${Math.min((dept.lateCount / 20) * 100, 100)}%` }} className="w-full rounded-t-lg bg-amber-400"></div>
                      </div>
                      {/* Early Out */}
                      <div className="w-3.5 sm:w-4 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-rose-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {dept.earlyOutCount}
                        </span>
                        <div style={{ height: `${Math.min((dept.earlyOutCount / 20) * 100, 100)}%` }} className="w-full rounded-t-lg bg-rose-500"></div>
                      </div>
                      {/* Early In */}
                      <div className="w-3.5 sm:w-4 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-emerald-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {dept.earlyInCount}
                        </span>
                        <div style={{ height: `${Math.min((dept.earlyInCount / 20) * 100, 100)}%` }} className="w-full rounded-t-lg bg-emerald-400"></div>
                      </div>
                      {/* Incomplete */}
                      <div className="w-3.5 sm:w-4 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-purple-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {dept.incompleteScanCount}
                        </span>
                        <div style={{ height: `${Math.min((dept.incompleteScanCount / 20) * 100, 100)}%` }} className="w-full rounded-t-lg bg-purple-500"></div>
                      </div>
                    </div>

                    <div className="absolute -bottom-10 left-0 right-0 text-center">
                      <p className="text-[11px] font-bold text-slate-300 truncate font-khmer">{dept.displayName}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{dept.employeeCount} Staff</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Department Metrics Breakdown Table */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <h3 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងស្ថិតិលម្អិតតាមដេប៉ាតឺម៉ង់ (Department Metrics Breakdown Table)' : 'Department Metrics Breakdown Table'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-khmer">
            Total : <span className="text-white font-bold">{departmentStats.length}</span> departments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 print:text-xs">
            <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10 print:bg-slate-100">
              <tr>
                <th className="py-3.5 px-4 font-khmer w-12 text-center">NO.</th>
                <th className="py-3.5 px-6 font-khmer">{t('departments')}</th>
                <th className="py-3.5 px-4 font-khmer text-center">{language === 'kh' ? 'ចំនួនបុគ្គលិក' : 'STAFF COUNT'}</th>
                <th className="py-3.5 px-4 font-khmer text-center text-amber-400">LATE (មកយឺត)</th>
                <th className="py-3.5 px-4 font-khmer text-center text-rose-400">EARLY OUT (ចេញមុន)</th>
                <th className="py-3.5 px-4 font-khmer text-center text-emerald-400">EARLY IN (មកមុន)</th>
                <th className="py-3.5 px-4 font-khmer text-center text-purple-400">INCOMPLETE (មិនគ្រប់)</th>
                <th className="py-3.5 px-4 font-khmer text-center font-bold text-white">{language === 'kh' ? 'សរុបទាំងអស់' : 'TOTAL INCIDENTS'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {departmentStats.map((dept, index) => (
                <tr key={dept.id || index} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">{index + 1}</td>
                  <td className="py-3.5 px-6 font-bold text-white font-khmer">{dept.displayName}</td>
                  <td className="py-3.5 px-4 text-center font-mono">{dept.employeeCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">{dept.lateCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-400">{dept.earlyOutCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">{dept.earlyInCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-purple-400">{dept.incompleteScanCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-400">{dept.totalIncidents}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-950/90 font-bold border-t-2 border-white/10 text-xs text-slate-200">
              <tr>
                <td colSpan="2" className="py-3.5 px-6 font-khmer text-right uppercase tracking-wider">{language === 'kh' ? 'សរុបរួម (TOTAL)' : 'TOTAL'}</td>
                <td className="py-3.5 px-4 text-center font-mono text-white">{departmentStats.reduce((acc, d) => acc + (d.employeeCount || 0), 0)}</td>
                <td className="py-3.5 px-4 text-center font-mono text-amber-400 font-black">{totals.totalLate}</td>
                <td className="py-3.5 px-4 text-center font-mono text-rose-400 font-black">{totals.totalEarlyOut}</td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-black">{totals.totalEarlyIn}</td>
                <td className="py-3.5 px-4 text-center font-mono text-purple-400 font-black">{totals.totalIncomplete}</td>
                <td className="py-3.5 px-4 text-center font-mono text-indigo-400 font-black">{totals.totalLate + totals.totalEarlyOut + totals.totalEarlyIn + totals.totalIncomplete}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Department Metrics Duration Breakdown Table (h:mn) */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            <h3 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងរយៈពេលស្ថិតិតាមដេប៉ាតឺម៉ង់ (Department Metrics Duration Table - h:mn)' : 'Department Metrics Duration Table (h:mn)'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-khmer">
            Total : <span className="text-white font-bold">{departmentStats.length}</span> departments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 print:text-xs">
            <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10 print:bg-slate-100">
              <tr>
                <th className="py-3.5 px-4 font-khmer w-12 text-center">NO.</th>
                <th className="py-3.5 px-6 font-khmer">{t('departments')}</th>
                <th className="py-3.5 px-4 font-khmer text-center">{language === 'kh' ? 'ចំនួនបុគ្គលិក' : 'STAFF COUNT'}</th>
                <th className="py-3.5 px-4 font-khmer text-center text-amber-400">LATE (មកយឺត)</th>
                <th className="py-3.5 px-4 font-khmer text-center text-rose-400">EARLY OUT (ចេញមុន)</th>
                <th className="py-3.5 px-4 font-khmer text-center text-emerald-400">EARLY IN (មកមុន)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {departmentStats.map((dept, index) => (
                <tr key={`dur-${dept.id || index}`} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">{index + 1}</td>
                  <td className="py-3.5 px-6 font-bold text-white font-khmer">{dept.displayName}</td>
                  <td className="py-3.5 px-4 text-center font-mono">{dept.employeeCount}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">{formatHMn(dept.lateMinutes)}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-400">{formatHMn(dept.earlyOutMinutes)}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">{formatHMn(dept.earlyInMinutes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-950/90 font-bold border-t-2 border-white/10 text-xs text-slate-200">
              <tr>
                <td colSpan="2" className="py-3.5 px-6 font-khmer text-right uppercase tracking-wider">{language === 'kh' ? 'សរុបរួម (TOTAL)' : 'TOTAL'}</td>
                <td className="py-3.5 px-4 text-center font-mono text-white">{departmentStats.reduce((acc, d) => acc + (d.employeeCount || 0), 0)}</td>
                <td className="py-3.5 px-4 text-center font-mono text-amber-400 font-black">{formatHMn(totals.totalLateMinutes)}</td>
                <td className="py-3.5 px-4 text-center font-mono text-rose-400 font-black">{formatHMn(totals.totalEarlyOutMinutes)}</td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-black">{formatHMn(totals.totalEarlyInMinutes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. Detailed Attendance Logs Table */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <h3 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងកំណត់ត្រាវត្តមានលម្អិត (Detailed Attendance Logs)' : 'Detailed Attendance Logs'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-khmer">
            Total : <span className="text-white font-bold">{logs.length}</span> records
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t('loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 print:text-xs">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10 print:bg-slate-100">
                <tr>
                  <th className="py-4 px-4 font-khmer w-14 text-center">No.</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('date')}</th>
                  <th className="py-4 px-6 font-khmer">{t('employees')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkin1')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkout1')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkin2')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('checkout2')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-khmer">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const emp = log.employee || {};
                    const photo = getEmployeePhoto(emp);
                    const nameEn = emp.nameEn || log.staffId || '';
                    const nameKh = emp.nameKh || '';
                    const deptName = emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '';
                    const posTitle = emp.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '';

                    return (
                      <tr key={log.id || index} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                        <td className="py-4 px-4 text-center font-bold text-slate-400 whitespace-nowrap font-mono">
                          {rowNumber}
                        </td>
                        <td className="py-4 px-6 font-semibold text-white whitespace-nowrap font-mono">
                          {formatDateDDMMYYYY(log.attendanceDate)}
                        </td>
                        <td className="py-4 px-6 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            {photo ? (
                              <img
                                src={photo}
                                alt={nameEn}
                                className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md print:hidden"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md print:hidden">
                                {nameEn?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white whitespace-nowrap">
                                {getLocalizedName(nameEn, nameKh) || log.staffId || '-'}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">
                                ID: <span className="text-indigo-400 font-semibold">{emp.staffId || log.staffId}</span>
                                {emp.role ? ` • ${emp.role}` : ''}
                              </p>
                              {(deptName || posTitle) && (
                                <p className="text-[11px] text-indigo-400 truncate">
                                  {[deptName, posTitle].filter(Boolean).join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap font-mono">{log.checkin1 ? formatTime12Hour(log.checkin1) : '-'}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-mono">{log.checkout1 ? formatTime12Hour(log.checkout1) : '-'}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-mono">{log.checkin2 ? formatTime12Hour(log.checkin2) : '-'}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-mono">{log.checkout2 ? formatTime12Hour(log.checkout2) : '-'}</td>
                        <td className="py-4 px-6 space-y-1 whitespace-nowrap">
                          {log._isLate && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20 font-khmer">
                              {t('late')}
                            </span>
                          )}
                          {log._isEarlyOut && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20 font-khmer ml-1">
                              {t('earlyLeave')}
                            </span>
                          )}
                          {log._isEarlyIn && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20 font-khmer ml-1">
                              {language === 'kh' ? 'មកមុន' : 'Early In'}
                            </span>
                          )}
                          {log._isIncomplete && (
                            <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300 ring-1 ring-inset ring-purple-500/20 font-khmer ml-1">
                              {language === 'kh' ? 'ស្កេនមិនគ្រប់' : 'Incomplete'}
                            </span>
                          )}
                          {log._isOnTime && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                              {t('normal')}
                            </span>
                          )}
                          {!log._isLate && !log._isEarlyOut && !log._isEarlyIn && !log._isIncomplete && !log._isOnTime && (
                            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20 font-khmer">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalRecords > 0 && (
          <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-slate-400 font-khmer">
              Total : <span className="font-bold text-white font-mono">{totalRecords}</span> records
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 min-w-[32px] px-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                &lsaquo;
              </button>

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
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-500'
                        : 'border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

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

export default Reports;
