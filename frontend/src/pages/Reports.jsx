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
import { formatTime12Hour } from '../utils/dateUtils';

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

  // 1. Calculate Department Comparison Data (Late, Early Out, Early In, Incomplete Scans)
  const departmentStats = useMemo(() => {
    if (departments.length === 0) return [];

    const defaultShift1StartMin = timeToMinutes(companyWorkHours?.shift1Start || '08:00') || 480;
    const defaultShift1EndMin = timeToMinutes(companyWorkHours?.shift1End || '12:00') || 720;
    const defaultShift2StartMin = timeToMinutes(companyWorkHours?.shift2Start || '13:00') || 780;
    const defaultShift2EndMin = timeToMinutes(companyWorkHours?.shift2End || '17:00') || 1020;
    const defaultWorkingDays = [1, 2, 3, 4, 5];

    // Build leaves map
    const leavesMap = new Map();
    leaves.forEach(lv => {
      if (lv.status === 'Approved' || lv.status === 'Pending') {
        const dateStr = lv.leaveDate ? new Date(lv.leaveDate).toISOString().split('T')[0] : '';
        if (lv.staffId && dateStr) {
          const key = `${lv.staffId}_${dateStr}`;
          if (!leavesMap.has(key)) leavesMap.set(key, []);
          leavesMap.get(key).push(lv);
        }
      }
    });

    // Build logs map
    const logsMap = new Map();
    logs.forEach(l => {
      const sId = l.employee?.staffId || l.staffId;
      const dateStr = l.attendanceDate ? new Date(l.attendanceDate).toISOString().split('T')[0] : '';
      if (sId && dateStr) {
        logsMap.set(`${sId}_${dateStr}`, l);
      }
    });

    // Generate date range list
    const dateList = [];
    let cur = new Date(startDate);
    const stop = new Date(endDate);
    while (cur <= stop) {
      dateList.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    return departments.map(dept => {
      const deptEmployees = employees.filter(e => {
        if (String(e.departmentId) !== String(dept.id)) return false;
        if (filterBranch && e.branch !== filterBranch) return false;
        if (e.status === 'Inactive' || e.status === 'Resigned' || e.status === 'Terminated') return false;
        return true;
      });

      let lateCount = 0;
      let earlyOutCount = 0;
      let earlyInCount = 0;
      let incompleteScanCount = 0;
      let onTimeCount = 0;
      let totalLogsCount = 0;

      deptEmployees.forEach(emp => {
        const s1Start = timeToMinutes(emp.shift1Start) || defaultShift1StartMin;
        const s2End = timeToMinutes(emp.shift2End) || defaultShift2EndMin;
        const hasShift2 = Boolean(emp.shift2Start && emp.shift2End && emp.shift2Start.trim() !== '');

        let empWorkingDays = defaultWorkingDays;
        if (emp.flexibleSchedule) {
          try {
            const parsed = typeof emp.flexibleSchedule === 'string' ? JSON.parse(emp.flexibleSchedule) : emp.flexibleSchedule;
            if (Array.isArray(parsed?.workingDays)) empWorkingDays = parsed.workingDays;
          } catch (e) {}
        }

        dateList.forEach(dateStr => {
          if (emp.joinDate && dateStr < emp.joinDate) return;

          const dateObj = new Date(dateStr);
          const dayOfWeek = dateObj.getDay();
          if (!empWorkingDays.includes(dayOfWeek)) return;

          const empLeaves = leavesMap.get(`${emp.staffId}_${dateStr}`) || [];
          let hasFullLeave = false;
          let hasMorningLeave = false;
          let hasAfternoonLeave = false;

          empLeaves.forEach(lv => {
            const dur = lv.durationType || '';
            const days = Number(lv.amountDays) || 1;
            const reason = (lv.reason || '').toLowerCase();
            if (dur === 'Full Day' || days >= 1.0 || (!dur && days >= 1.0)) {
              hasFullLeave = true;
            } else if (dur === 'Morning' || reason.includes('morning') || reason.includes('shift 1')) {
              hasMorningLeave = true;
            } else if (dur === 'Afternoon' || reason.includes('afternoon') || reason.includes('shift 2')) {
              hasAfternoonLeave = true;
            }
          });

          if (hasFullLeave) return;

          const log = logsMap.get(`${emp.staffId}_${dateStr}`);
          const c1 = log?.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--' ? log.checkin1 : null;
          const o1 = log?.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--' ? log.checkout1 : null;
          const c2 = log?.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--' ? log.checkin2 : null;
          const o2 = log?.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--' ? log.checkout2 : null;

          const shift1Required = !hasMorningLeave;
          const shift2Required = hasShift2 && !hasAfternoonLeave;

          const missingC1 = shift1Required && !c1;
          const missingO1 = shift1Required && !o1;
          const missingC2 = shift2Required && !c2;
          const missingO2 = shift2Required && !o2;

          if (missingC1 || missingO1 || missingC2 || missingO2) {
            incompleteScanCount += 1;
          }

          if (log) {
            totalLogsCount += 1;

            if (log.isLate) {
              lateCount += 1;
            } else if (c1) {
              const c1Min = timeToMinutes(c1);
              if (c1Min && c1Min > s1Start) lateCount += 1;
            }

            if (log.isEarlyLeave) {
              earlyOutCount += 1;
            } else if (o2) {
              const o2Min = timeToMinutes(o2);
              if (o2Min && o2Min < s2End) earlyOutCount += 1;
            }

            if (c1) {
              const c1Min = timeToMinutes(c1);
              if (c1Min && c1Min < s1Start) earlyInCount += 1;
            }

            if (!log.isLate && !log.isEarlyLeave) {
              onTimeCount += 1;
            }
          }
        });
      });

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
      };
    });
  }, [departments, employees, logs, leaves, companyWorkHours, startDate, endDate, filterBranch, language]);

  // Overall Totals
  const totals = useMemo(() => {
    const totalLate = departmentStats.reduce((acc, d) => acc + d.lateCount, 0);
    const totalEarlyOut = departmentStats.reduce((acc, d) => acc + d.earlyOutCount, 0);
    const totalEarlyIn = departmentStats.reduce((acc, d) => acc + d.earlyInCount, 0);
    const totalIncomplete = departmentStats.reduce((acc, d) => acc + d.incompleteScanCount, 0);
    const totalLogs = logs.length;
    const totalOnTime = logs.filter(l => !l.isLate && !l.isEarlyLeave).length;
    return { totalLate, totalEarlyOut, totalEarlyIn, totalIncomplete, totalLogs, totalOnTime };
  }, [departmentStats, logs]);

  // 2. Metric Config & Ranking
  const metricConfigs = {
    late: {
      key: 'lateCount',
      titleEn: 'Late Arrivals (មកយឺត)',
      titleKh: 'បុគ្គលិកមកយឺត (Late Arrivals)',
      color: '#f59e0b',
      bgLight: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      barGradient: 'from-amber-600 to-amber-400',
      totalCount: totals.totalLate,
      unit: language === 'kh' ? 'ដង' : 'times',
    },
    earlyOut: {
      key: 'earlyOutCount',
      titleEn: 'Early Out (ចេញមុន)',
      titleKh: 'បុគ្គលិកចេញមុនម៉ោង (Early Out)',
      color: '#f43f5e',
      bgLight: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      barGradient: 'from-rose-600 to-rose-400',
      totalCount: totals.totalEarlyOut,
      unit: language === 'kh' ? 'ដង' : 'times',
    },
    earlyIn: {
      key: 'earlyInCount',
      titleEn: 'Early In (មកមុន)',
      titleKh: 'បុគ្គលិកមកមុនម៉ោង (Early In)',
      color: '#10b981',
      bgLight: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      barGradient: 'from-emerald-600 to-emerald-400',
      totalCount: totals.totalEarlyIn,
      unit: language === 'kh' ? 'ដង' : 'times',
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
      totalCount: totals.totalIncomplete,
      unit: language === 'kh' ? 'ដង' : 'times',
    },
    all: {
      key: 'totalIncidents',
      titleEn: 'All Metrics Combined (ប្រៀបធៀបទាំងអស់)',
      titleKh: 'ប្រៀបធៀបគ្រប់ទិន្នន័យ (All Metrics)',
      color: '#6366f1',
      bgLight: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-400',
      barGradient: 'from-indigo-600 to-purple-500',
      totalCount: totals.totalLate + totals.totalEarlyOut + totals.totalEarlyIn + totals.totalIncomplete,
      unit: language === 'kh' ? 'ករណី' : 'incidents',
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
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    if (maxVal <= 20) return 20;
    if (maxVal <= 50) return Math.ceil(maxVal / 10) * 10;
    return Math.ceil(maxVal / 20) * 20;
  }, [maxSelectedValue]);

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

  // Pagination for Detailed Logs Table
  const totalRecords = logs.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

    const startDisplay = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Start';
    const endDisplay = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'End';
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

    logs.forEach((log, idx) => {
      const emp = log.employee || {};
      const dept = emp.department ? (emp.department.nameEn || '') : '';
      const pos = emp.position ? (emp.position.titleEn || '') : '';

      let status = 'On Time';
      if (log.isLate && log.isEarlyLeave) status = 'Late & Early Leave';
      else if (log.isLate) status = 'Late';
      else if (log.isEarlyLeave) status = 'Early Leave';

      excelHTML += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${log.attendanceDate ? new Date(log.attendanceDate).toLocaleDateString() : '-'}</td>
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

      {/* Date Filter & Department / Branch Strip */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 no-print">
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
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-4 rounded-2xl border border-white/5 text-center">
          <span className="block text-[11px] text-slate-400 font-semibold uppercase font-khmer">Total Logs</span>
          <span className="block text-xl font-bold mt-1 text-white font-mono">{totals.totalLogs}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 text-center">
          <span className="block text-[11px] text-emerald-400 font-semibold uppercase font-khmer">{t('normal')}</span>
          <span className="block text-xl font-bold mt-1 text-emerald-400 font-mono">{totals.totalOnTime}</span>
        </div>
        <div
          onClick={() => setSelectedMetric('late')}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            selectedMetric === 'late' ? 'border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-white/5 hover:border-amber-500/30'
          }`}
        >
          <span className="block text-[11px] text-amber-400 font-semibold uppercase font-khmer">Late (មកយឺត)</span>
          <span className="block text-xl font-bold mt-1 text-amber-400 font-mono">{totals.totalLate}</span>
        </div>
        <div
          onClick={() => setSelectedMetric('earlyOut')}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            selectedMetric === 'earlyOut' ? 'border-rose-500/80 bg-rose-500/10 shadow-lg shadow-rose-500/10' : 'border-white/5 hover:border-rose-500/30'
          }`}
        >
          <span className="block text-[11px] text-rose-400 font-semibold uppercase font-khmer">Early Out (ចេញមុន)</span>
          <span className="block text-xl font-bold mt-1 text-rose-400 font-mono">{totals.totalEarlyOut}</span>
        </div>
        <div
          onClick={() => setSelectedMetric('earlyIn')}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            selectedMetric === 'earlyIn' ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-emerald-500/30'
          }`}
        >
          <span className="block text-[11px] text-emerald-400 font-semibold uppercase font-khmer">Early In (មកមុន)</span>
          <span className="block text-xl font-bold mt-1 text-emerald-400 font-mono">{totals.totalEarlyIn}</span>
        </div>
        <div
          onClick={() => setSelectedMetric('incomplete')}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            selectedMetric === 'incomplete' ? 'border-purple-500/80 bg-purple-500/10 shadow-lg shadow-purple-500/10' : 'border-white/5 hover:border-purple-500/30'
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
                    {rankingAnalysis.highest[currentMetricConfig.key]}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    {currentMetricConfig.unit} ({currentMetricConfig.totalCount > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalCount) * 100) : 0}% នៃចំនួនសរុប)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.highest.employeeCount} នាក់ • មធ្យម: {(rankingAnalysis.highest[currentMetricConfig.key] / Math.max(rankingAnalysis.highest.employeeCount, 1)).toFixed(1)} {currentMetricConfig.unit}/នាក់
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
                    {rankingAnalysis.medium ? rankingAnalysis.medium[currentMetricConfig.key] : 0}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    {currentMetricConfig.unit} ({rankingAnalysis.medium && currentMetricConfig.totalCount > 0 ? Math.round((rankingAnalysis.medium[currentMetricConfig.key] / currentMetricConfig.totalCount) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.medium ? rankingAnalysis.medium.employeeCount : 0} នាក់ • មធ្យម: {rankingAnalysis.medium ? (rankingAnalysis.medium[currentMetricConfig.key] / Math.max(rankingAnalysis.medium.employeeCount, 1)).toFixed(1) : 0} {currentMetricConfig.unit}/នាក់
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
                    {rankingAnalysis.lowest[currentMetricConfig.key]}
                  </span>
                  <span className="text-xs text-slate-400 font-khmer">
                    {currentMetricConfig.unit} ({currentMetricConfig.totalCount > 0 ? Math.round((rankingAnalysis.lowest[currentMetricConfig.key] / currentMetricConfig.totalCount) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  បុគ្គលិក: {rankingAnalysis.lowest.employeeCount} នាក់ • មធ្យម: {(rankingAnalysis.lowest[currentMetricConfig.key] / Math.max(rankingAnalysis.lowest.employeeCount, 1)).toFixed(1)} {currentMetricConfig.unit}/នាក់
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
                    ដេប៉ាតឺម៉ង់ដែលមានចំនួន <span className={`font-bold ${currentMetricConfig.text}`}>{currentMetricConfig.titleKh}</span> <strong>ច្រើនជាងគេ</strong> គឺ <span className="text-white font-bold">{rankingAnalysis.highest.displayName}</span> (<strong>{rankingAnalysis.highest[currentMetricConfig.key]} {currentMetricConfig.unit}</strong>, ស្មើនឹង {currentMetricConfig.totalCount > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalCount) * 100) : 0}%)។
                    {rankingAnalysis.medium && (
                      <> ចំណែកដេប៉ាតឺម៉ង់ <strong>កម្រិតមធ្យម</strong> គឺ <span className="text-white font-bold">{rankingAnalysis.medium.displayName}</span> (<strong>{rankingAnalysis.medium[currentMetricConfig.key]} {currentMetricConfig.unit}</strong>)។</>
                    )}
                    {` ហើយដេប៉ាតឺម៉ង់ដែលមានចំនួន `}
                    <strong>តិចជាងគេបំផុត</strong> គឺ <span className="text-emerald-400 font-bold">{rankingAnalysis.lowest.displayName}</span> (<strong>{rankingAnalysis.lowest[currentMetricConfig.key]} {currentMetricConfig.unit}</strong>)។
                  </>
                ) : (
                  <>
                    The department with the <strong>Highest</strong> {currentMetricConfig.titleEn} is <span className="text-white font-bold">{rankingAnalysis.highest.displayName}</span> ({rankingAnalysis.highest[currentMetricConfig.key]} {currentMetricConfig.unit}, {currentMetricConfig.totalCount > 0 ? Math.round((rankingAnalysis.highest[currentMetricConfig.key] / currentMetricConfig.totalCount) * 100) : 0}%).
                    {rankingAnalysis.medium && (
                      <> The <strong>Moderate/Medium</strong> department is <span className="text-white font-bold">{rankingAnalysis.medium.displayName}</span> ({rankingAnalysis.medium[currentMetricConfig.key]} {currentMetricConfig.unit}).</>
                    )}
                    {` Meanwhile, the department with the `}
                    <strong>Lowest/Best compliance</strong> is <span className="text-emerald-400 font-bold">{rankingAnalysis.lowest.displayName}</span> ({rankingAnalysis.lowest[currentMetricConfig.key]} {currentMetricConfig.unit}).
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
                <span className="text-slate-500 font-mono text-[11px] bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/5">
                  Total: {currentMetricConfig.totalCount} {currentMetricConfig.unit}
                </span>
              </div>

              {/* Chart Mode Selector: Vertical (បញ្ឈរ) vs Horizontal (ផ្ដេក) */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 shadow-inner self-start sm:self-auto">
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
                  <span>{language === 'kh' ? 'ក្រាហ្វបញ្ឈរ' : 'Vertical'}</span>
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
                  <span>{language === 'kh' ? 'ក្រាហ្វផ្ដេក' : 'Horizontal'}</span>
                </button>
              </div>
            </div>

            {/* View 1: ក្រាហ្វបញ្ឈរ (Vertical Column Chart) */}
            {chartOrientation === 'vertical' ? (
              <div className="bg-slate-950/70 border border-white/5 rounded-3xl p-5 sm:p-6 space-y-3">
                <div className="w-full overflow-x-auto pb-4 pt-2">
                  <div className="min-w-[550px] h-84 relative flex items-end justify-around px-6 pt-10 pb-24 border-b border-l border-white/10">
                    {/* Background horizontal grid lines with values */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pl-6 pr-2 pb-24 pt-10">
                      {gridTicks.map((val, idx) => (
                        <div key={idx} className="w-full flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span className="w-6 text-right font-bold">{val}</span>
                          <div className="flex-1 h-px bg-white/5"></div>
                        </div>
                      ))}
                    </div>

                    {/* Columns for each department */}
                    {sortedBySelectedMetric.map((dept, index) => {
                      const count = dept[currentMetricConfig.key] || 0;
                      const heightPercent = chartMax > 0 ? (count / chartMax) * 100 : 0;
                      const totalPct = currentMetricConfig.totalCount > 0 ? Math.round((count / currentMetricConfig.totalCount) * 100) : 0;

                      let tierBadge = {
                        labelKh: 'កម្រិតទាប (Low)',
                        labelEn: 'Low',
                        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      };
                      let rankColor = 'bg-slate-800 text-slate-300';

                      if (index === 0) {
                        tierBadge = {
                          labelKh: 'ច្រើនជាងគេ (Highest)',
                          labelEn: 'Highest',
                          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        };
                        rankColor = 'bg-rose-500 text-white shadow-sm shadow-rose-500/40';
                      } else if (index === 1 || (index > 0 && index < sortedBySelectedMetric.length - 1)) {
                        tierBadge = {
                          labelKh: 'កម្រិតមធ្យម (Medium)',
                          labelEn: 'Medium',
                          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
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
                            <span className={`text-base font-black font-mono leading-none ${currentMetricConfig.text}`}>
                              {count}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
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
                          <div className="absolute -bottom-22 left-0 right-0 text-center flex flex-col items-center">
                            <p className="text-xs font-bold text-slate-200 truncate max-w-[130px] font-khmer" title={dept.displayName}>
                              {dept.displayName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {dept.employeeCount} {language === 'kh' ? 'បុគ្គលិក' : 'Staff'}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border font-khmer mt-1 inline-block ${tierBadge.badgeBg}`}>
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
                  const totalPct = currentMetricConfig.totalCount > 0 ? Math.round((count / currentMetricConfig.totalCount) * 100) : 0;

                  let tierBadge = {
                    labelKh: 'កម្រិតទាប (Low)',
                    labelEn: 'Low',
                    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  };

                  if (index === 0) {
                    tierBadge = {
                      labelKh: 'ច្រើនជាងគេ (Highest)',
                      labelEn: 'Highest',
                      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    };
                  } else if (index === 1 || (index > 0 && index < sortedBySelectedMetric.length - 1)) {
                    tierBadge = {
                      labelKh: 'កម្រិតមធ្យម (Medium)',
                      labelEn: 'Medium',
                      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    };
                  }

                  return (
                    <div
                      key={dept.id || index}
                      className="bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-white/15 rounded-2xl p-4 transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                            index === 0 ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/40' : (index === 1 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300')
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <span className="font-bold text-white font-khmer text-sm">{dept.displayName}</span>
                            <span className="text-slate-400 text-xs font-mono ml-2">({dept.employeeCount} Staff)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-khmer ${tierBadge.badgeBg}`}>
                            {language === 'kh' ? tierBadge.labelKh : tierBadge.labelEn}
                          </span>
                          <div className="text-right">
                            <span className={`text-base font-black font-mono ${currentMetricConfig.text}`}>
                              {count}
                            </span>
                            <span className="text-slate-400 text-xs font-khmer ml-1">{currentMetricConfig.unit}</span>
                            <span className="text-slate-500 text-xs font-mono ml-1.5">({totalPct}%)</span>
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
                          {log.attendanceDate ? new Date(log.attendanceDate).toLocaleDateString() : '-'}
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
                          {log.isLate && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20 font-khmer">
                              {t('late')}
                            </span>
                          )}
                          {log.isEarlyLeave && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20 font-khmer ml-1">
                              {t('earlyLeave')}
                            </span>
                          )}
                          {!log.isLate && !log.isEarlyLeave && (log.checkin1 || log.checkin2 || log.checkout1 || log.checkout2) && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                              {t('normal')}
                            </span>
                          )}
                          {!(log.checkin1 || log.checkin2 || log.checkout1 || log.checkout2) && (
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
