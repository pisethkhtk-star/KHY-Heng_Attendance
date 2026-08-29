import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatTime12Hour } from '../utils/dateUtils';

// Helper to parse HH:mm or HH:mm:ss to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// Helper to format minutes to "18m", "1h", "1h 5m"
const formatDuration = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

import { formatDateDDMMYYYY, formatDateWithMonth } from '../utils/dateUtils';

// Helper to format Date into DD MMMM YYYY (e.g. "01 August 2026")
const formatDisplayDate = (dateString, locale = 'en') => {
  return formatDateWithMonth(dateString, locale);
};

const AttendanceLate = () => {
  const { user } = useAuth();
  const { t, getLocalizedName, language } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const empDropdownRef = useRef(null);

  // Default: Start of current month (1st day) to today in local timezone
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
  const [lateGraceMinutes, setLateGraceMinutes] = useState(0);

  const fetchInitialData = async () => {
    try {
      const [deptRes, empRes, whRes] = await Promise.all([
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/company-work-hours').catch(() => ({ data: null })),
      ]);
      setDepartments(deptRes.data || []);
      setEmployees(empRes.data || []);
      if (whRes.data && whRes.data.lateGraceMinutes !== undefined) {
        setLateGraceMinutes(Number(whRes.data.lateGraceMinutes) || 0);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

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

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (!empSearchQuery || !empSearchQuery.trim()) return true;
      const q = empSearchQuery.trim().toLowerCase();
      const staffId = (emp.staffId || '').toLowerCase();
      const nameEn = (emp.nameEn || '').toLowerCase();
      const nameKh = (emp.nameKh || '').toLowerCase();
      return staffId.includes(q) || nameEn.includes(q) || nameKh.includes(q);
    });
  }, [employees, empSearchQuery]);

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
      const allLogs = response.data || [];
      // Strictly filter late records
      const lateLogs = allLogs.filter(l => Boolean(l.isLate));
      setLogs(lateLogs);
    } catch (error) {
      console.error('Error loading late attendance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate, selectedStaffId, filterDept]);

  // Compute late minutes and formatted check details for each log
  const processedLogs = useMemo(() => {
    return logs.map(log => {
      const emp = log.employee || {};
      const s1StartStr = emp.shift1Start || '08:00';
      const s2StartStr = emp.shift2Start || '13:00';

      const s1StartMin = timeToMinutes(s1StartStr) ?? 480;
      const s2StartMin = timeToMinutes(s2StartStr) ?? 780;

      const c1Min = timeToMinutes(log.checkin1);
      const c2Min = timeToMinutes(log.checkin2);

      const grace = Number(lateGraceMinutes) || 0;
      const s1GraceThreshold = s1StartMin + grace;
      const s2GraceThreshold = s2StartMin + grace;

      let late1 = 0;
      let late2 = 0;

      // Only count as late if scan time strictly exceeds shift start + grace minutes
      if (c1Min !== null && c1Min > s1GraceThreshold) {
        late1 = c1Min - s1StartMin;
      }
      if (c2Min !== null && c2Min > s2GraceThreshold) {
        late2 = c2Min - s2StartMin;
      }

      // If flag isLate is true but calculated minutes is 0, default to min 1m
      let totalLateMin = late1 + late2;
      if (totalLateMin === 0 && log.isLate) {
        totalLateMin = 1;
      }

      // Format Check string: Show ONLY the Shift that was late
      const formatTimeOnly = (t) => {
        if (!t) return '';
        const formatted = formatTime12Hour(t);
        return formatted === '-' ? '' : formatted;
      };

      const checkItems = [];
      const isShift1Late = late1 > 0;
      const isShift2Late = late2 > 0;

      if (isShift1Late && !isShift2Late) {
        // ONLY Shift 1 is late
        const in1 = formatTimeOnly(log.checkin1);
        const out1 = formatTimeOnly(log.checkout1);
        checkItems.push(`Shift 1: IN : ${in1 || '-'} - OUT : ${out1 || '-'}`);
      } else if (isShift2Late && !isShift1Late) {
        // ONLY Shift 2 is late
        const in2 = formatTimeOnly(log.checkin2);
        const out2 = formatTimeOnly(log.checkout2);
        checkItems.push(`Shift 2: IN : ${in2 || '-'} - OUT : ${out2 || '-'}`);
      } else if (isShift1Late && isShift2Late) {
        // BOTH Shift 1 and Shift 2 are late
        const in1 = formatTimeOnly(log.checkin1);
        const out1 = formatTimeOnly(log.checkout1);
        const in2 = formatTimeOnly(log.checkin2);
        const out2 = formatTimeOnly(log.checkout2);
        checkItems.push(`Shift 1: IN : ${in1 || '-'} - OUT : ${out1 || '-'}`);
        checkItems.push(`Shift 2: IN : ${in2 || '-'} - OUT : ${out2 || '-'}`);
      } else {
        // Fallback when log.isLate is true but exact minutes diff was equal
        if (c1Min !== null && c1Min > s1StartMin) {
          const in1 = formatTimeOnly(log.checkin1);
          const out1 = formatTimeOnly(log.checkout1);
          checkItems.push(`Shift 1: IN : ${in1 || '-'} - OUT : ${out1 || '-'}`);
        } else if (c2Min !== null && c2Min > s2StartMin) {
          const in2 = formatTimeOnly(log.checkin2);
          const out2 = formatTimeOnly(log.checkout2);
          checkItems.push(`Shift 2: IN : ${in2 || '-'} - OUT : ${out2 || '-'}`);
        } else if (log.checkin2 && !log.checkin1) {
          const in2 = formatTimeOnly(log.checkin2);
          const out2 = formatTimeOnly(log.checkout2);
          checkItems.push(`Shift 2: IN : ${in2 || '-'} - OUT : ${out2 || '-'}`);
        } else if (log.checkin1 && !log.checkin2) {
          const in1 = formatTimeOnly(log.checkin1);
          const out1 = formatTimeOnly(log.checkout1);
          checkItems.push(`Shift 1: IN : ${in1 || '-'} - OUT : ${out1 || '-'}`);
        } else {
          // If both exist, include shift 1 if not empty or both
          if (log.checkin1) checkItems.push(`Shift 1: IN : ${formatTimeOnly(log.checkin1) || '-'} - OUT : ${formatTimeOnly(log.checkout1) || '-'}`);
          if (log.checkin2) checkItems.push(`Shift 2: IN : ${formatTimeOnly(log.checkin2) || '-'} - OUT : ${formatTimeOnly(log.checkout2) || '-'}`);
        }
      }

      const checkString = checkItems.length > 0 ? checkItems.join(' | ') : `IN : ${formatTimeOnly(log.checkin1)} - OUT : ${formatTimeOnly(log.checkout1)}`;

      // Note formatting
      let displayNote = log.note || '';
      if (!displayNote && log.isLate) {
        displayNote = 'Checkin: Late';
      }

      return {
        ...log,
        empStaffId: emp.staffId || log.staffId || 'UNKNOWN',
        empNameEn: emp.nameEn || '',
        empNameKh: emp.nameKh || '',
        empDept: emp.department?.nameEn || '',
        totalLateMin,
        lateDurationFormatted: formatDuration(totalLateMin),
        checkString,
        displayNote,
      };
    });
  }, [logs]);

  // Client-side search filter
  const filteredLogs = useMemo(() => {
    if (!search || !search.trim()) return processedLogs;
    const term = search.toLowerCase().trim();
    return processedLogs.filter(l => {
      const staffId = (l.empStaffId || '').toLowerCase();
      const nameEn = (l.empNameEn || '').toLowerCase();
      const nameKh = (l.empNameKh || '').toLowerCase();
      const note = (l.displayNote || '').toLowerCase();
      return staffId.includes(term) || nameEn.includes(term) || nameKh.includes(term) || note.includes(term);
    });
  }, [processedLogs, search]);

  // Group records by Employee
  const groupedByEmployee = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      const key = log.empStaffId;
      if (!groups[key]) {
        groups[key] = {
          staffId: log.empStaffId,
          nameEn: log.empNameEn,
          nameKh: log.empNameKh,
          dept: log.empDept,
          records: [],
          totalLateMin: 0,
          countLate: 0,
        };
      }
      groups[key].records.push(log);
      groups[key].totalLateMin += log.totalLateMin;
      groups[key].countLate += 1;
    });

    // Sort records inside each group by attendanceDate asc/desc
    Object.values(groups).forEach(g => {
      g.records.sort((a, b) => new Date(a.attendanceDate) - new Date(b.attendanceDate));
    });

    return Object.values(groups);
  }, [filteredLogs]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalCount = filteredLogs.length;
    const totalMinutes = filteredLogs.reduce((acc, l) => acc + l.totalLateMin, 0);
    const totalFormatted = formatDuration(totalMinutes);
    const uniqueEmployees = groupedByEmployee.length;
    return { totalCount, totalMinutes, totalFormatted, uniqueEmployees };
  }, [filteredLogs, groupedByEmployee]);

  const handleExportCSV = () => {
    if (groupedByEmployee.length === 0) return;

    const startDisplay = formatDisplayDate(startDate, 'en');
    const endDisplay = formatDisplayDate(endDate, 'en');
    const title = `Checkin Late Report ${startDisplay} to ${endDisplay}`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Late Report</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; }
          .title-row { font-size: 14pt; font-weight: bold; text-align: center; height: 35px; }
          .emp-name { font-size: 11pt; font-weight: bold; color: #000000; height: 26px; }
          .emp-sub { font-size: 10pt; font-weight: bold; color: #1f2937; height: 22px; }
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; }
          table.report-table th { border: 1px solid #000000; background-color: #f3f4f6; font-weight: bold; text-align: left; padding: 6px 10px; font-size: 10pt; }
          table.report-table td { border: 1px solid #000000; padding: 6px 10px; font-size: 10pt; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
          <tr>
            <td colspan="5" class="title-row" style="font-size:14pt; font-weight:bold; text-align:center; height:35px;">
              ${title}
            </td>
          </tr>
        </table>
    `;

    groupedByEmployee.forEach((group) => {
      const empName = group.nameEn ? group.nameEn.toUpperCase() : group.staffId;
      const posTitle = group.positionTitle || group.records[0]?.employee?.position?.titleEn || '';
      const deptName = group.dept || group.records[0]?.employee?.department?.nameEn || '';
      const subInfo = [posTitle, deptName].filter(Boolean).join(' | ');
      const totalDur = formatDuration(group.totalLateMin);

      excelHTML += `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <tr>
            <td colspan="5" style="font-size:11pt; font-weight:bold; color:#000000; height:24px;">
              ${empName} | ${group.staffId}
            </td>
          </tr>
          ${subInfo ? `
          <tr>
            <td colspan="5" style="font-size:10pt; font-weight:bold; color:#1f2937; height:20px;">
              ${subInfo}
            </td>
          </tr>` : ''}
        </table>

        <table class="report-table" border="1" style="border-collapse:collapse; width:100%; border:1px solid #000000; margin-bottom:20px;">
          <thead>
            <tr style="background-color:#f3f4f6;">
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:50px;">No</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:260px;">Check</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px;">Checkin Late</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold;">Note</th>
            </tr>
          </thead>
          <tbody>
      `;

      group.records.forEach((rec, idx) => {
        const rowNo = idx + 1;
        const rowDate = formatDisplayDate(rec.attendanceDate, 'en');
        const rowCheck = rec.checkString;
        const rowLate = rec.lateDurationFormatted;
        const rowNote = rec.displayNote || '';

        excelHTML += `
          <tr>
            <td style="border:1px solid #000000; text-align:center; padding:5px 8px;">${rowNo}</td>
            <td style="border:1px solid #000000; padding:5px 10px;">${rowDate}</td>
            <td style="border:1px solid #000000; padding:5px 10px;">${rowCheck}</td>
            <td style="border:1px solid #000000; padding:5px 10px; font-weight:bold;">${rowLate}</td>
            <td style="border:1px solid #000000; padding:5px 10px;">${rowNote}</td>
          </tr>
        `;
      });

      excelHTML += `
            <tr>
              <td style="border:1px solid #000000;"></td>
              <td style="border:1px solid #000000;"></td>
              <td style="border:1px solid #000000;"></td>
              <td style="border:1px solid #000000; font-weight:bold; padding:6px 10px;">${totalDur}</td>
              <td style="border:1px solid #000000;"></td>
            </tr>
          </tbody>
        </table>
      `;
    });

    excelHTML += `
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Checkin_Late_Report_${startDate}_to_${endDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/5">
            <ClockIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-khmer flex items-center gap-2">
              <span>{t("lateRecords")}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {overallStats.totalCount} {language === 'kh' ? 'ដង' : 'records'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-khmer">
              {language === 'kh'
                ? 'តាមដាន និងគ្រប់គ្រងម៉ោងមកយឺតរបស់បុគ្គលិកនីមួយៗ'
                : 'Track and review exact late arrival duration for each employee'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl glow-indigo border border-amber-500/20 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-khmer">
                {language === 'kh' ? 'ចំនួនដងមកយឺតសរុប' : 'Total Late Checks'}
              </p>
              <h3 className="text-2xl font-black text-amber-500 mt-1 font-mono">
                {overallStats.totalCount}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl glow-indigo border border-amber-500/20 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-khmer">
                {language === 'kh' ? 'បុគ្គលិកមកយឺត' : 'Late Employees'}
              </p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">
                {overallStats.uniqueEmployees}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <UserGroupIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl glow-indigo border border-amber-500/20 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-khmer">
                {language === 'kh' ? 'ម៉ោងមកយឺតសរុប' : 'Total Late Time'}
              </p>
              <h3 className="text-2xl font-black text-amber-500 mt-1 font-mono">
                {overallStats.totalFormatted}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Start Date */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all font-mono font-semibold"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("endDate")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all font-mono font-semibold"
          />
        </div>

        {/* HR/Admin query parameters */}
        {user.role !== 'Employee' ? (
          <>
            {/* Employee Searchable Select Dropdown */}
            <div className="space-y-1 relative" ref={empDropdownRef}>
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                {t("employees")}
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
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
                  className="absolute left-0 right-0 top-full mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {/* Inline Search Input */}
                  <div style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }} className="p-2 border-b">
                    <input
                      type="text"
                      value={empSearchQuery}
                      onChange={(e) => setEmpSearchQuery(e.target.value)}
                      placeholder="Searching..."
                      style={{ color: '#000000', backgroundColor: '#FFFFFF', borderColor: '#2D60FF' }}
                      className="w-full py-1.5 px-3 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400 font-medium font-sans"
                      autoFocus
                    />
                  </div>

                  {/* Options List */}
                  <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-100 font-sans">
                    {filteredEmployees.length === 0 ? (
                      <div style={{ color: '#64748B' }} className="py-3 px-3 text-center text-xs font-khmer">
                        {t("noData")}
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = selectedStaffId === emp.staffId;
                        const label = `${emp.nameEn?.toUpperCase() || emp.nameKh} | ${emp.staffId}`;
                        return (
                          <div
                            key={emp.id || emp.staffId}
                            onClick={() => {
                              setSelectedStaffId(emp.staffId);
                              setIsEmpDropdownOpen(false);
                              setEmpSearchQuery('');
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
                            {emp.status === 'Resigned' && (
                              <span
                                style={{
                                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#FEE2E2',
                                  color: isSelected ? '#FFFFFF' : '#DC2626',
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded font-bold ml-2"
                              >
                                Resigned
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Department Filter */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("departments")}</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:bg-slate-900 outline-none transition-all font-khmer cursor-pointer"
              >
                <option value="" className="bg-slate-900">{language === 'kh' ? 'គ្រប់ផ្នែកទាំងអស់' : 'All Departments'}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id} className="bg-slate-900">
                    {dept.nameKh || dept.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>

      {/* Main Content Area - Grouped Employee Late Tables */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></span>
        </div>
      ) : groupedByEmployee.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-white/10 text-center">
          <ExclamationTriangleIcon className="h-10 w-10 mx-auto text-slate-600 mb-2 opacity-60" />
          <p className="text-sm font-semibold text-slate-400 font-khmer">
            {language === 'kh'
              ? 'មិនមានទិន្នន័យបុគ្គលិកមកយឺតក្នុងចន្លោះកាលបរិច្ឆេទនេះទេ'
              : 'No late attendance records found for this period.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByEmployee.map(group => {
            const empDisplayName = group.nameEn ? group.nameEn.toUpperCase() : group.staffId;
            const totalDuration = formatDuration(group.totalLateMin);

            return (
              <div key={group.staffId} className="space-y-2">
                {/* Employee Title Header: English Name & Employee ID Black and Bold */}
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-base md:text-lg font-black text-black tracking-wide font-sans flex items-center gap-2">
                    <span className="font-black text-black text-base">{empDisplayName}</span>
                    <span className="text-slate-400 font-black">|</span>
                    <span className="font-black text-black text-base">{group.staffId}</span>
                  </h2>
                  <div className="text-xs font-black text-black font-khmer">
                    {language === 'kh' ? 'ចំនួនមកយឺត:' : 'Count Late:'} <span className="font-black text-black">{group.countLate}</span>
                  </div>
                </div>

                {/* Styled Table matching the exact columns of the screenshot */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#2D60FF] text-[11px] font-black text-white uppercase border-b border-blue-600 font-sans tracking-wider">
                        <tr>
                          <th className="py-3 px-4 border-r border-blue-400/30 w-44 whitespace-nowrap text-white">
                            DATE
                          </th>
                          <th className="py-3 px-4 border-r border-blue-400/30 w-80 whitespace-nowrap text-white">
                            CHECK
                          </th>
                          <th className="py-3 px-4 border-r border-blue-400/30 w-28 whitespace-nowrap text-white">
                            LATE
                          </th>
                          <th className="py-3 px-4 text-white">
                            DESCRIPTION
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-sans">
                        {group.records.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                            {/* DATE: Clean readable slate */}
                            <td className="py-3 px-4 border-r border-slate-200 font-semibold text-[#334155] text-xs whitespace-nowrap">
                              {formatDisplayDate(rec.attendanceDate, 'en')}
                            </td>

                            {/* Check: Clean readable mono text */}
                            <td className="py-3 px-4 border-r border-slate-200 font-mono text-[#334155] font-semibold text-xs whitespace-nowrap">
                              {rec.checkString}
                            </td>

                            {/* LATE: Rich Amber text */}
                            <td className="py-3 px-4 border-r border-slate-200 font-semibold text-[#D97706] whitespace-nowrap font-mono text-xs">
                              {rec.lateDurationFormatted}
                            </td>

                            {/* DESCRIPTION: Clean readable text */}
                            <td className="py-3 px-4 text-xs font-medium text-[#475569] font-khmer">
                              {rec.displayNote}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Footer Summary Row */}
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-xs">
                        <tr>
                          <td colSpan={2} className="py-3 px-4 border-r border-slate-300 text-slate-500 font-sans">
                            {/* Empty or Left info */}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-300 text-[#334155] font-sans whitespace-nowrap">
                            <div className="text-xs font-semibold text-[#1E293B]">Total: <span className="font-bold text-[#D97706] font-mono text-xs">{totalDuration}</span></div>
                            <div className="text-[11px] font-medium text-[#475569] mt-0.5">Count Late: <span className="font-bold text-[#1E293B] font-mono">{group.countLate}</span></div>
                          </td>
                          <td className="py-3 px-4">
                            {/* Note footer */}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttendanceLate;
