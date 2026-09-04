import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { MagnifyingGlassIcon, PencilIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon, ArrowUpTrayIcon, DocumentArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

import { formatTime12Hour, formatDateDDMMYYYY } from '../utils/dateUtils';

const TimePicker12Hour = ({ label, value, onChange }) => {
  const parseTimeTo12Hour = (time24) => {
    if (!time24) return { hour: '', minute: '', ampm: 'AM' };
    const parts = time24.split(':');
    if (parts.length < 2) return { hour: '', minute: '', ampm: 'AM' };

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];

    if (isNaN(hours)) return { hour: '', minute: '', ampm: 'AM' };

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return {
      hour: String(hours).padStart(2, '0'),
      minute: minutes,
      ampm
    };
  };

  const formatTimeTo24Hour = (hour, minute, ampm) => {
    if (!hour || !minute) return '';
    let h = parseInt(hour, 10);
    if (isNaN(h)) return '';
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  };

  const { hour, minute, ampm } = parseTimeTo12Hour(value);

  const handleHourChange = (newHour) => {
    if (!newHour) {
      onChange('');
    } else {
      onChange(formatTimeTo24Hour(newHour, minute || '00', ampm));
    }
  };

  const handleMinuteChange = (newMinute) => {
    if (!newMinute) {
      onChange('');
    } else {
      onChange(formatTimeTo24Hour(hour || '12', newMinute, ampm));
    }
  };

  const handleAmpmChange = (newAmpm) => {
    if (!hour && !minute) return;
    onChange(formatTimeTo24Hour(hour || '12', minute || '00', newAmpm));
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
        {label}
      </label>
      <div className="flex gap-1.5 items-center bg-slate-950 border border-white/10 rounded-xl p-2.5 justify-between">
        {/* Hour Select */}
        <select
          value={hour}
          onChange={(e) => handleHourChange(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-xs font-semibold cursor-pointer w-12 text-center"
        >
          <option value="" className="bg-slate-900 text-slate-500">--</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
            <option key={h} value={h} className="bg-slate-900 text-white">{h}</option>
          ))}
        </select>

        <span className="text-slate-500 text-xs">:</span>

        {/* Minute Select */}
        <select
          value={minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-xs font-semibold cursor-pointer w-12 text-center animate-none"
        >
          <option value="" className="bg-slate-900 text-slate-500">--</option>
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
            <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
          ))}
        </select>

        {/* AM/PM Select */}
        <select
          value={ampm}
          onChange={(e) => handleAmpmChange(e.target.value)}
          className="bg-transparent border-none outline-none text-indigo-400 text-xs font-bold cursor-pointer w-12 text-center"
        >
          <option value="AM" className="bg-slate-900 text-white">AM</option>
          <option value="PM" className="bg-slate-900 text-white">PM</option>
        </select>
      </div>
    </div>
  );
};

const getEmpPhoto = (emp) => {
  if (!emp) return null;
  if (emp.photoUrl) return emp.photoUrl;
  if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
  if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
  return null;
};

const Attendance = () => {
  const { user, hasPermission } = useAuth();
  const { locale, t, getLocalizedName } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Unified Add/Edit Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null); // null = Add Mode, object = Edit Mode
  const [staffId, setStaffId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkin1, setCheckin1] = useState('');
  const [checkout1, setCheckout1] = useState('');
  const [checkin2, setCheckin2] = useState('');
  const [checkout2, setCheckout2] = useState('');
  const [note, setNote] = useState('');

  const [employeesList, setEmployeesList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Excel Import States
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelRows, setExcelRows] = useState([]);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [rawSheetData, setRawSheetData] = useState([]);
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [columnMapping, setColumnMapping] = useState({
    staffId: '',
    attendanceDate: '',
    checkin1: '',
    checkout1: '',
    checkin2: '',
    checkout2: '',
    note: '',
  });
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const excelFileInputRef = useRef(null);

  // Filters & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [showResign, setShowResign] = useState(false);
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const empDropdownRef = useRef(null);

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
  const [filterBranch, _setFilterBranch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (user?.role === 'Employee') {
        query += `&staffId=${user?.staffId}`;
      } else {
        if (selectedStaffId) {
          query += `&staffId=${selectedStaffId}`;
        } else if (search && search.trim()) {
          query += `&search=${encodeURIComponent(search.trim())}`;
        }
        if (filterDept) query += `&departmentId=${filterDept}`;
        if (filterBranch) query += `&branch=${filterBranch}`;
      }

      const response = await api.get(`/attendances/history${query}`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error loading attendance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const playSound = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.16);
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      }
    } catch (err) {
      console.error(err);
    }
  };


  const handleOpenEditModal = (log) => {
    setErrorMsg('');
    setSelectedLog(log);
    setStaffId(log.employee.staffId);
    setAttendanceDate(new Date(log.attendanceDate).toISOString().split('T')[0]);
    setCheckin1(log.checkin1 || '');
    setCheckout1(log.checkout1 || '');
    setCheckin2(log.checkin2 || '');
    setCheckout2(log.checkout2 || '');
    setNote(log.note || '');
    setShowModal(true);
  };

  const handleOpenAddModal = async () => {
    setErrorMsg('');
    setSelectedLog(null);
    setStaffId('');
    setAttendanceDate(new Date().toISOString().split('T')[0]);
    setCheckin1('');
    setCheckout1('');
    setCheckin2('');
    setCheckout2('');
    setNote('');
    setShowModal(true);

    try {
      const res = await api.get('/employees');
      setEmployeesList(res.data);
      if (res.data.length > 0) {
        setStaffId(res.data[0].staffId);
      }
    } catch (err) {
      console.error('Error fetching employees list:', err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    if (selectedLog) {
      // Edit mode
      try {
        const res = await api.put(`/attendances/${selectedLog.id}`, {
          checkin1,
          checkout1,
          checkin2,
          checkout2,
          note
        });

        setLogs(prev => prev.map(item => {
          if (item.id === selectedLog.id) {
            return {
              ...item,
              ...res.data.data
            };
          }
          return item;
        }));

        playSound('success');
        setShowModal(false);
        setSelectedLog(null);
      } catch (error) {
        console.error('Error saving attendance log:', error);
        setErrorMsg(error.response?.data?.message || 'Error updating record');
        playSound('error');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Add mode
      if (!staffId) {
        setErrorMsg('Please select an employee (សូមជ្រើសរើសបុគ្គលិក)');
        setSubmitting(false);
        return;
      }
      try {
        const res = await api.post('/attendances', {
          staffId,
          attendanceDate,
          checkin1,
          checkout1,
          checkin2,
          checkout2,
          note
        });

        setLogs(prev => [res.data.data, ...prev]);

        playSound('success');
        setShowModal(false);
      } catch (error) {
        console.error('Error creating attendance log:', error);
        setErrorMsg(error.response?.data?.message || 'Error creating record');
        playSound('error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDelete = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this attendance log? (តើអ្នកប្រាកដជាចង់លុបវត្តមាននេះមែនទេ?)')) {
      return;
    }

    try {
      await api.delete(`/attendances/${logId}`);
      setLogs(prev => prev.filter(item => item.id !== logId));
      playSound('success');
    } catch (error) {
      console.error('Error deleting attendance log:', error);
      alert('Failed to delete attendance log.');
      playSound('error');
    }
  };

  const fetchMetadata = async () => {
    try {
      if (user?.role !== 'Employee') {
        const [deptRes, empRes] = await Promise.all([
          api.get('/departments'),
          api.get('/employees')
        ]);
        setDepartments(deptRes.data);
        setEmployeesList(empRes.data);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Close employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    return employeesList.filter(emp => {
      // 1. Resign filter
      if (!showResign && (emp.status === 'Resigned' || emp.status === 'Terminated')) {
        return false;
      }
      // 2. Search query filter
      if (!empSearchQuery || !empSearchQuery.trim()) return true;
      const q = empSearchQuery.trim().toLowerCase();
      const stId = (emp.staffId || '').toLowerCase();
      const nameEn = (emp.nameEn || '').toLowerCase();
      const nameKh = (emp.nameKh || '').toLowerCase();
      return stId.includes(q) || nameEn.includes(q) || nameKh.includes(q);
    });
  }, [employeesList, showResign, empSearchQuery]);

  const empMap = useMemo(() => {
    const map = new Map();
    employeesList.forEach(e => {
      if (e.staffId) map.set(e.staffId, e);
    });
    return map;
  }, [employeesList]);

  useEffect(() => {
    setCurrentPage(1);
    fetchLogs();
  }, [startDate, endDate, search, selectedStaffId, filterDept, filterBranch]);

  const displayLogs = logs.filter(log => {
    // Hide record if all checkin/checkout times are null or empty
    const hasAnyTime = Boolean(
      (log.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--') ||
      (log.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--') ||
      (log.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--') ||
      (log.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--')
    );
    if (!hasAnyTime) return false;

    // Filter by selected employee from dropdown
    if (selectedStaffId) {
      const empId = log.employee?.staffId || log.staffId;
      if (empId !== selectedStaffId) return false;
    }

    if (!search || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    const stId = (log.employee?.staffId || log.staffId || '').toLowerCase();
    const nameEn = (log.employee?.nameEn || '').toLowerCase();
    const nameKh = (log.employee?.nameKh || '').toLowerCase();
    return stId.includes(q) || nameEn.includes(q) || nameKh.includes(q);
  });

  const totalRecords = displayLogs.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedLogs = displayLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    if (displayLogs.length === 0) return;

    const startDisplay = startDate ? formatDateDDMMYYYY(startDate) : 'Start';
    const endDisplay = endDate ? formatDateDDMMYYYY(endDate) : 'End';
    const title = `All Attendance History Logs (${startDisplay} to ${endDisplay})`;

    const totalLogs = displayLogs.length;
    const totalLate = displayLogs.filter(l => l.isLate).length;
    const totalEarlyLeave = displayLogs.filter(l => l.isEarlyLeave).length;
    const totalOnTime = displayLogs.filter(l => !l.isLate && !l.isEarlyLeave).length;

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
            <td colspan="13" class="title-row">${title}</td>
          </tr>
          <tr>
            <td colspan="13" style="text-align:center; font-size:9pt; color:#64748b; height:20px;">
              Exported on: ${new Date().toLocaleString()}
            </td>
          </tr>
        </table>

        <!-- Summary Statistics Table -->
        <table class="kpi-table" border="1">
          <thead>
            <tr>
              <th style="background-color:#1e293b; color:#ffffff;">TOTAL ATTENDANCE RECORDS</th>
              <th style="background-color:#1e293b; color:#ffffff;">ON TIME RECORDS</th>
              <th style="background-color:#1e293b; color:#ffffff;">LATE ARRIVALS</th>
              <th style="background-color:#1e293b; color:#ffffff;">EARLY DEPARTURES</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color:#ffffff;">
              <td style="color:#2563eb; font-size:13pt;">${totalLogs}</td>
              <td style="color:#059669; font-size:13pt;">${totalOnTime}</td>
              <td style="color:#d97706; font-size:13pt;">${totalLate}</td>
              <td style="color:#e11d48; font-size:13pt;">${totalEarlyLeave}</td>
            </tr>
          </tbody>
        </table>

        <br/>

        <!-- Detailed Attendance Table -->
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

    displayLogs.forEach((log, idx) => {
      const targetStaffId = log.employee?.staffId || log.staffId;
      const matchedEmp = (targetStaffId && empMap.get(targetStaffId)) || {};
      const emp = { ...matchedEmp, ...(log.employee || {}) };
      const nameEn = emp.nameEn || matchedEmp.nameEn || '';
      const nameKh = emp.nameKh || matchedEmp.nameKh || '';
      const role = emp.role || matchedEmp.role || '';
      const deptObj = emp.department || matchedEmp.department;
      const posObj = emp.position || matchedEmp.position;
      const deptName = deptObj ? (typeof deptObj === 'string' ? deptObj : (deptObj.nameEn || '')) : '';
      const posTitle = posObj ? (typeof posObj === 'string' ? posObj : (posObj.titleEn || '')) : '';

      let statusLabel = 'On Time';
      if (log.isLate && log.isEarlyLeave) {
        statusLabel = 'Late & Early Leave';
      } else if (log.isLate) {
        statusLabel = 'Late';
      } else if (log.isEarlyLeave) {
        statusLabel = 'Early Leave';
      }

      excelHTML += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${formatDateDDMMYYYY(log.attendanceDate)}</td>
          <td style="font-weight:bold;">${targetStaffId || '-'}</td>
          <td>${nameEn}</td>
          <td>${nameKh}</td>
          <td>${role}</td>
          <td>${deptName}</td>
          <td>${posTitle}</td>
          <td>${log.checkin1 ? formatTime12Hour(log.checkin1) : '-'}</td>
          <td>${log.checkout1 ? formatTime12Hour(log.checkout1) : '-'}</td>
          <td>${log.checkin2 ? formatTime12Hour(log.checkin2) : '-'}</td>
          <td>${log.checkout2 ? formatTime12Hour(log.checkout2) : '-'}</td>
          <td>${statusLabel}</td>
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
    link.setAttribute('download', `Attendance_All_Logs_${startDate}_to_${endDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isStaffIdVal = (val) => {
    if (!val) return false;
    const s = String(val).trim();
    if (!s) return false;
    if (/^\d+$/.test(s)) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) return false;
    if (/^\d{1,2}:\d{2}/.test(s)) return false;
    if (s.includes(' ')) return false;

    const lower = s.toLowerCase();
    const commonWords = new Set([
      'no', 'no.', 'name', 'date', 'sex', 'gender', 'role', 'status', 'dept', 'pos', 'note',
      'time', 'in', 'out', 'remark', 'department', 'position', 'branch', 'email', 'title',
      'active', 'male', 'female', 'yes', 'true', 'false', 'លរ', 'ល.រ', 'ឈ្មោះ', 'ភេទ', 'កាលបរិច្ឆេទ'
    ]);
    if (commonWords.has(lower)) return false;

    if (s.length < 2 || s.length > 20) return false;

    const hasLetter = /[A-Za-z\u1780-\u17FF]/.test(s);
    const hasDigit = /\d/.test(s);
    const hasSeparator = /[-_/]/.test(s);

    if ((hasLetter && hasDigit) || (hasLetter && hasSeparator) || (/^[A-Za-z]{1,4}\d{1,6}$/i.test(s))) {
      return /^[A-Za-z0-9\u1780-\u17FF\-_/]+$/.test(s);
    }
    return false;
  };

  const detectAttendanceCol = (colName) => {
    if (!colName) return null;
    const clean = String(colName).trim().toLowerCase().replace(/[\s_\-():]/g, '');

    // Sequence / Index column (No / # / ល.រ) - NEVER Staff ID
    if (
      clean === 'no' || clean === 'no.' || clean === 'លរ' || clean === 'ល.រ' ||
      clean === '#' || clean === 'n°' || clean === 'index' || clean === 'seq' ||
      clean === 'item' || clean === 'num' || clean === 'number' || clean === 'លេខរៀង'
    ) {
      return 'rowNo';
    }

    // Staff ID
    if (
      clean.includes('staffid') || clean.includes('staff') ||
      clean.includes('empid') || clean.includes('emp_id') || clean.includes('employeeid') ||
      clean.includes('empno') || clean === 'id' || clean.includes('idcard') ||
      clean.includes('code') || clean.includes('cardno') || clean.includes('badge') ||
      clean.includes('userid') || clean.includes('user_id') || clean.includes('enroll') ||
      clean.includes('acno') || clean.includes('pin') ||
      clean.includes('អត្តលេខ') || clean.includes('លេខសម្គាល់') || clean.includes('កូដ') ||
      clean.includes('លេខកូដ') || clean.includes('លេខកាត') || clean.includes('លេខប័ណ្ណ')
    ) {
      return 'staffId';
    }

    // Attendance Date
    if (
      clean.includes('date') || clean.includes('day') || clean.includes('attendancedate') ||
      clean.includes('កាលបរិច្ឆេទ') || clean.includes('ថ្ងៃ') || clean.includes('ថ្ងៃខែ')
    ) {
      return 'attendanceDate';
    }

    // Checkin 2 (Shift 2 In) - MUST BE CHECKED BEFORE Checkin 1
    if (
      clean.includes('checkin2') || clean.includes('in2') || clean.includes('timein2') ||
      clean.includes('ម៉ោងចូល២') || clean.includes('ម៉ោងចូល2') || clean.includes('ចូល២') || clean.includes('ចូល2') ||
      clean.includes('ចូលរសៀល') || clean.includes('រសៀលចូល')
    ) {
      return 'checkin2';
    }

    // Checkout 2 (Shift 2 Out) - MUST BE CHECKED BEFORE Checkout 1
    if (
      clean.includes('checkout2') || clean.includes('out2') || clean.includes('timeout2') ||
      clean.includes('ម៉ោងចេញ២') || clean.includes('ម៉ោងចេញ2') || clean.includes('ចេញ២') || clean.includes('ចេញ2') ||
      clean.includes('ចេញរសៀល') || clean.includes('រសៀលចេញ')
    ) {
      return 'checkout2';
    }

    // Checkin 1 (Shift 1 In)
    if (
      clean.includes('checkin1') || clean.includes('in1') || clean.includes('timein1') ||
      clean.includes('checkin') || clean.includes('timein') || clean === 'in' ||
      clean.includes('ម៉ោងចូល១') || clean.includes('ម៉ោងចូល1') || clean.includes('ចូល១') || clean.includes('ចូល1') ||
      clean.includes('ចូលព្រឹក') || clean.includes('ព្រឹកចូល') || clean.includes('ម៉ោងចូល') || clean === 'ចូល'
    ) {
      return 'checkin1';
    }

    // Checkout 1 (Shift 1 Out)
    if (
      clean.includes('checkout1') || clean.includes('out1') || clean.includes('timeout1') ||
      clean.includes('checkout') || clean.includes('timeout') || clean === 'out' ||
      clean.includes('ម៉ោងចេញ១') || clean.includes('ម៉ោងចេញ1') || clean.includes('ចេញ១') || clean.includes('ចេញ1') ||
      clean.includes('ចេញព្រឹក') || clean.includes('ព្រឹកចេញ') || clean.includes('ម៉ោងចេញ') || clean === 'ចេញ'
    ) {
      return 'checkout1';
    }

    // Note
    if (clean.includes('note') || clean.includes('remark') || clean.includes('description') || clean.includes('កំណត់សម្គាល់') || clean.includes('ផ្សេងៗ') || clean.includes('សម្គាល់')) {
      return 'note';
    }

    return null;
  };

  const formatDateForBackend = (val) => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (val instanceof Date && !isNaN(val)) {
      return val.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const formatTimeVal = (val, isAfternoon = false) => {
    if (val === null || val === undefined) return '';

    // 1. If it's an Excel fractional time number (e.g. 0.3541666 = 08:30, 0.722222 = 17:20)
    if (typeof val === 'number') {
      if (val >= 0 && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    // 2. If it's a Date object
    if (val instanceof Date && !isNaN(val)) {
      const h = val.getHours();
      const m = val.getMinutes();
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const str = String(val).trim();
    if (!str || str === '-' || str === '--:--') return '';

    // 3. Match time string (e.g. "08:28", "8:28 AM", "05:20 PM", "17:20", "5:20")
    const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const ampm = ampmMatch[4] ? ampmMatch[4].toUpperCase() : null;

      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      } else if (!ampm && isAfternoon) {
        // If afternoon shift and 1 <= hours <= 7 (e.g. 1:00 -> 13:00, 5:20 -> 17:20)
        if (hours >= 1 && hours <= 7) {
          hours += 12;
        }
      }

      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    return '';
  };

  const applyMappingAndBuildAttendanceRows = (data, hIdx, mapping) => {
    if (!data || data.length <= hIdx + 1) {
      setExcelRows([]);
      return;
    }

    const headers = data[hIdx] || [];
    const getColIndex = (fieldKey) => {
      const colName = mapping[fieldKey];
      if (!colName) return -1;
      return headers.findIndex(h => String(h || '').trim() === colName);
    };

    const idxStaffId = getColIndex('staffId');
    const idxDate = getColIndex('attendanceDate');
    const idxCheckin1 = getColIndex('checkin1');
    const idxCheckout1 = getColIndex('checkout1');
    const idxCheckin2 = getColIndex('checkin2');
    const idxCheckout2 = getColIndex('checkout2');
    const idxNote = getColIndex('note');

    const dataRows = data.slice(hIdx + 1);
    const processed = [];

    dataRows.forEach((row) => {
      if (!Array.isArray(row)) return;
      const hasContent = row.some(cell => String(cell || '').trim() !== '');
      if (!hasContent) return;

      const getVal = (idx) => (idx >= 0 && idx < row.length ? String(row[idx] || '').trim() : '');

      let rawStaffId = getVal(idxStaffId);
      let rawDate = getVal(idxDate);
      const rawIn1 = getVal(idxCheckin1);
      const rawOut1 = getVal(idxCheckout1);
      const rawIn2 = getVal(idxCheckin2);
      const rawOut2 = getVal(idxCheckout2);
      const rawNote = getVal(idxNote);

      const warnings = [];
      if (!rawStaffId) {
        warnings.push(locale === 'kh' ? 'ខ្វះ Staff ID' : 'Missing Staff ID');
      }

      let matchedEmp = rawStaffId ? empMap.get(rawStaffId) : null;
      if (rawStaffId && !matchedEmp) {
        const lowerId = rawStaffId.toLowerCase();
        for (const [k, v] of empMap.entries()) {
          if (k.toLowerCase() === lowerId) {
            matchedEmp = v;
            rawStaffId = v.staffId;
            break;
          }
        }
        if (!matchedEmp) {
          warnings.push(locale === 'kh' ? `រកមិនឃើញបុគ្គលិក (${rawStaffId})` : `Employee not found (${rawStaffId})`);
        }
      }

      if (!rawDate) {
        rawDate = new Date().toISOString().split('T')[0];
      } else {
        rawDate = formatDateForBackend(rawDate);
      }

      const in1 = formatTimeVal(rawIn1, false);
      const out1 = formatTimeVal(rawOut1, false);
      const in2 = formatTimeVal(rawIn2, true);
      const out2 = formatTimeVal(rawOut2, true);

      const hasAnyTime = Boolean(in1 || out1 || in2 || out2);
      if (!hasAnyTime) {
        warnings.push(locale === 'kh' ? 'គ្មានម៉ោងចូល/ចេញ' : 'No check-in/out times');
      }

      processed.push({
        rowIndex: processed.length + 1,
        staffId: rawStaffId,
        empName: matchedEmp ? (matchedEmp.nameEn || matchedEmp.nameKh) : '-',
        departmentName: matchedEmp?.department?.nameEn || matchedEmp?.department?.nameKh || '-',
        attendanceDate: rawDate,
        checkin1: in1,
        checkout1: out1,
        checkin2: in2,
        checkout2: out2,
        note: rawNote,
        isValid: warnings.length === 0,
        warnings,
      });
    });

    setExcelRows(processed);
  };

  const parseAttendanceExcelFile = (file) => {
    if (!file) return;
    setExcelFile(file);
    setExcelFileName(file.name);
    setExcelError('');
    setExcelImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

        if (!sheetData || sheetData.length === 0) {
          setExcelError(locale === 'kh' ? 'ឯកសារ Excel គ្មានទិន្នន័យទេ' : 'Excel file contains no data');
          setExcelRows([]);
          return;
        }

        const headerKeywords = [
          'staff', 'id', 'code', 'emp', 'date', 'day', 'checkin', 'checkout', 'in', 'out', 'note',
          'អត្តលេខ', 'លេខសម្គាល់', 'កូដ', 'កាលបរិច្ឆេទ', 'ថ្ងៃ', 'ម៉ោងចូល', 'ម៉ោងចេញ', 'ចូល', 'ចេញ', 'កំណត់សម្គាល់'
        ];

        let bestHeaderIdx = 0;
        let maxScore = -1;

        for (let r = 0; r < Math.min(sheetData.length, 15); r++) {
          const row = sheetData[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          // If this row contains actual employee IDs, it's a DATA ROW, not header!
          const hasDataValues = row.some(cell => isStaffIdVal(cell));
          if (hasDataValues) {
            if (maxScore < 2 && r > 0) {
              bestHeaderIdx = r - 1;
            }
            break;
          }

          let score = 0;
          row.forEach(cell => {
            const cellStr = String(cell || '').trim().toLowerCase();
            if (cellStr) {
              headerKeywords.forEach(kw => {
                if (cellStr.includes(kw)) score += 2;
              });
            }
          });
          if (score > maxScore && score >= 2) {
            maxScore = score;
            bestHeaderIdx = r;
          }
        }

        setHeaderRowIdx(bestHeaderIdx);
        setRawSheetData(sheetData);

        const rawHeaders = sheetData[bestHeaderIdx] || [];
        const detectedColList = rawHeaders.map((h, i) => {
          const cleanH = String(h || '').trim();
          return cleanH || `Column ${String.fromCharCode(65 + i)}`;
        });
        setAvailableHeaders(detectedColList);

        const newMapping = {
          staffId: '',
          attendanceDate: '',
          checkin1: '',
          checkout1: '',
          checkin2: '',
          checkout2: '',
          note: '',
        };

        detectedColList.forEach(colName => {
          const matchedField = detectAttendanceCol(colName);
          if (matchedField && matchedField !== 'rowNo' && !newMapping[matchedField]) {
            newMapping[matchedField] = colName;
          }
        });

        // Content-based inspection for staffId and date
        const sampleRows = sheetData.slice(bestHeaderIdx + 1, bestHeaderIdx + 26)
          .filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));

        let contentStaffIdCol = null;
        let maxIdScore = 0;

        detectedColList.forEach((colName, cIdx) => {
          let idMatchCount = 0;
          let totalCells = 0;

          sampleRows.forEach((row) => {
            const val = String(row[cIdx] || '').trim();
            if (!val) return;
            totalCells++;

            if (isStaffIdVal(val)) {
              idMatchCount++;
            }
          });

          if (totalCells > 0 && (idMatchCount / totalCells >= 0.35) && idMatchCount > maxIdScore) {
            maxIdScore = idMatchCount;
            contentStaffIdCol = colName;
          }
        });

        if (contentStaffIdCol) {
          newMapping.staffId = contentStaffIdCol;
        }

        setColumnMapping(newMapping);
        applyMappingAndBuildAttendanceRows(sheetData, bestHeaderIdx, newMapping);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setExcelError(locale === 'kh' ? 'មានបញ្ហាក្នុងការអានឯកសារ Excel' : 'Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadAttendanceTemplate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const templateData = [
      {
        'Staff ID': employeesList[0]?.staffId || 'EMP-001',
        'Date': todayStr,
        'Check-in 1': '08:00',
        'Check-out 1': '12:00',
        'Check-in 2': '13:00',
        'Check-out 2': '17:00',
        'Note': 'Normal work'
      },
      {
        'Staff ID': employeesList[1]?.staffId || 'EMP-002',
        'Date': todayStr,
        'Check-in 1': '07:55',
        'Check-out 1': '12:05',
        'Check-in 2': '13:02',
        'Check-out 2': '17:01',
        'Note': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Template');
    XLSX.writeFile(wb, 'Attendance_Import_Template.xlsx');
  };

  const handleInsertAllAttendance = async () => {
    const validRows = excelRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setExcelError(locale === 'kh' ? 'គ្មានទិន្នន័យត្រឹមត្រូវសម្រាប់បញ្ចូលទេ' : 'No valid records ready to insert');
      return;
    }

    setExcelImportLoading(true);
    setExcelError('');
    try {
      const payload = validRows.map(r => ({
        staffId: r.staffId,
        attendanceDate: r.attendanceDate,
        checkin1: r.checkin1,
        checkout1: r.checkout1,
        checkin2: r.checkin2,
        checkout2: r.checkout2,
        note: r.note,
      }));

      const res = await api.post('/attendances/batch', payload);
      setExcelImportResult(res.data);
      playSound('success');
      await fetchLogs();
    } catch (err) {
      console.error('Error inserting excel attendance:', err);
      setExcelError(err.response?.data?.message || (locale === 'kh' ? 'មានបញ្ហាក្នុងការបញ្ចូលទិន្នន័យ' : 'Failed to insert attendance records'));
      playSound('error');
    } finally {
      setExcelImportLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title Block */}
      <div className="glass-card p-6 rounded-2xl glow-indigo flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("attendance")}</h2>
          <p className="text-slate-400 text-xs mt-1">Review check-in history logs and shifts compliance</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>

          {hasPermission('add_attendance') && (
            <button
              type="button"
              onClick={() => {
                setShowExcelModal(true);
                setExcelFile(null);
                setExcelFileName('');
                setExcelRows([]);
                setExcelError('');
                setExcelImportResult(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg cursor-pointer font-khmer"
            >
              <ArrowUpTrayIcon className="h-4 w-4 stroke-[2.5]" />
              <span>{locale === 'kh' ? 'នាំចូល Excel' : 'Import Excel'}</span>
            </button>
          )}

          {hasPermission('add_attendance') && (
            <button
              onClick={handleOpenAddModal}
              className="py-2.5 px-5 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-md shadow-indigo-500/25 font-khmer border-none outline-none cursor-pointer flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Attendance</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Filters */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("endDate")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>

        {/* HR/Admin query parameters */}
        {user?.role !== 'Employee' ? (
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
                className={`w-full py-2 px-3 border rounded-xl text-sm flex items-center justify-between cursor-pointer transition-all shadow-sm ${isEmpDropdownOpen ? 'ring-2 ring-blue-500/20' : 'hover:border-slate-400'
                  }`}
              >
                <span
                  style={{ color: selectedStaffId ? '#000000' : '#475569' }}
                  className={`truncate text-xs ${selectedStaffId ? 'font-bold' : 'font-medium'}`}
                >
                  {selectedStaffId ? (
                    (() => {
                      const emp = employeesList.find(e => e.staffId === selectedStaffId);
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
                            className={`py-2.5 px-3 text-xs cursor-pointer transition-colors flex items-center justify-between font-semibold ${isSelected ? 'font-bold' : 'hover:!bg-blue-50 hover:!text-[#2D60FF]'
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
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("departments")}</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
              >
                <option value="">{t("selectDept")} ({t("all")})</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900">{getLocalizedName(d.nameEn, d.nameKh)}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="md:col-span-2 flex items-center justify-end p-4 bg-slate-950/40 border border-white/5 rounded-xl text-xs font-medium text-slate-400 font-khmer">
            🔍 កំពុងបង្ហាញកំណត់ត្រាវត្តមានសម្រាប់គណនីរបស់អ្នកផ្ទាល់ ({user?.staffId})
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-4 px-4 font-khmer whitespace-nowrap text-center">No.</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("date")}</th>
                  {user?.role !== 'Employee' && <th className="py-4 px-6 font-khmer">{t("employees")}</th>}
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("checkin1")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("checkout1")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("checkin2")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("checkout2")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("status")}</th>
                  <th className="py-4 px-6 font-khmer min-w-[260px]">{t("description")}</th>
                  {(hasPermission('edit_attendance') || hasPermission('delete_attendance')) && (
                    <th className="py-4 px-6 font-khmer text-right whitespace-nowrap">{t("actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'Employee' ? 8 : ((hasPermission('edit_attendance') || hasPermission('delete_attendance')) ? 10 : 9)} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const targetStaffId = log.employee?.staffId || log.staffId;
                    const matchedEmp = (targetStaffId && empMap.get(targetStaffId)) || (user?.staffId === targetStaffId ? user : null) || {};
                    const emp = { ...matchedEmp, ...(log.employee || {}) };
                    const photo = getEmpPhoto(emp) || getEmpPhoto(matchedEmp) || (user?.staffId === targetStaffId ? user?.photoUrl : null);
                    const nameEn = emp.nameEn || matchedEmp.nameEn || '';
                    const nameKh = emp.nameKh || matchedEmp.nameKh || '';
                    const displayName = getLocalizedName(nameEn, nameKh) || targetStaffId || '-';
                    const role = emp.role || matchedEmp.role || '';
                    const deptObj = emp.department || matchedEmp.department;
                    const posObj = emp.position || matchedEmp.position;
                    const deptName = deptObj ? (typeof deptObj === 'string' ? deptObj : getLocalizedName(deptObj.nameEn, deptObj.nameKh)) : '';
                    const posTitle = posObj ? (typeof posObj === 'string' ? posObj : getLocalizedName(posObj.titleEn, posObj.titleKh)) : '';

                    return (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 font-mono text-center text-slate-400 font-bold whitespace-nowrap">
                          {rowNumber}
                        </td>
                        <td className="py-4 px-6 font-semibold text-white whitespace-nowrap">
                          {formatDateDDMMYYYY(log.attendanceDate)}
                        </td>
                        {user?.role !== 'Employee' && (
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
                                  {nameEn?.charAt(0)?.toUpperCase() || nameKh?.charAt(0) || targetStaffId?.charAt(0) || '?'}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white whitespace-nowrap">
                                  {displayName}
                                </p>
                                <p className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                  ID: <span className="text-indigo-400 font-semibold">{targetStaffId}</span>{role ? ` • ${role}` : ''}
                                </p>
                                {(deptName || posTitle) && (
                                  <p className="text-xs font-semibold text-indigo-400 whitespace-nowrap">
                                    {[deptName, posTitle].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="py-4 px-6 whitespace-nowrap font-medium">{formatTime12Hour(log.checkin1)}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-medium">{formatTime12Hour(log.checkout1)}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-medium">{formatTime12Hour(log.checkin2)}</td>
                        <td className="py-4 px-6 whitespace-nowrap font-medium">{formatTime12Hour(log.checkout2)}</td>
                        <td className="py-4 px-6 space-y-1 whitespace-nowrap">
                          {log.isLate && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20 font-khmer">
                              {t("late")}
                            </span>
                          )}
                          {log.isEarlyLeave && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20 font-khmer ml-1">
                              {t("earlyLeave")}
                            </span>
                          )}
                          {!log.isLate && !log.isEarlyLeave && (log.checkin1 || log.checkin2 || log.checkout1 || log.checkout2) && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                              {t("normal")}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-400 min-w-[260px] max-w-[400px] whitespace-normal break-words leading-relaxed">{log.note || '-'}</td>
                        {(hasPermission('edit_attendance') || hasPermission('delete_attendance')) && (
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPermission('edit_attendance') && (
                                <button
                                  onClick={() => handleOpenEditModal(log)}
                                  className="inline-flex p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-lg transition-colors cursor-pointer"
                                  title={t("edit")}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                              )}
                              {hasPermission('delete_attendance') && (
                                <button
                                  onClick={() => handleDelete(log.id)}
                                  className="inline-flex p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                  title={t("delete")}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
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
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${isCurrent
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

      {/* Unified Add/Edit Attendance Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl glow-indigo border border-white/10 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-slate-950/40">
              <h3 className="text-lg font-bold text-white font-khmer">
                {selectedLog ? 'Edit Attendance' : 'Add Attendance'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {selectedLog
                  ? ` ${getLocalizedName(selectedLog.employee.nameEn, selectedLog.employee.nameKh)} (ID: ${selectedLog.employee.staffId})`
                  : ''}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-khmer animate-pulse">
                    {errorMsg}
                  </div>
                )}

                {selectedLog ? (
                  // Edit mode fields (Read-only metadata)
                  <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-white/5 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-khmer">Employee</p>
                      <p className="text-white font-bold mt-1 font-khmer">
                        {selectedLog.employee.staffId} - {getLocalizedName(selectedLog.employee.nameEn, selectedLog.employee.nameKh)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-khmer">Date</p>
                      <p className="text-white font-bold mt-1">
                        {formatDateDDMMYYYY(selectedLog.attendanceDate)}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Add mode fields (Select employee & Date)
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("employees")}</label>
                      <select
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        className="w-full py-2.5 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer cursor-pointer"
                      >
                        <option value="">Select Employee...</option>
                        {employeesList.map(emp => (
                          <option key={emp.id} value={emp.staffId} className="bg-slate-900">
                            {emp.staffId} - {getLocalizedName(emp.nameEn, emp.nameKh)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">កាលបរិច្ឆេទ (Date)</label>
                      <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="w-full py-2.5 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer font-khmer"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Shift 1 */}
                  <TimePicker12Hour
                    label="Check In 1"
                    value={checkin1}
                    onChange={setCheckin1}
                  />
                  <TimePicker12Hour
                    label="Check Out 1"
                    value={checkout1}
                    onChange={setCheckout1}
                  />

                  {/* Shift 2 */}
                  <TimePicker12Hour
                    label="Check In 2"
                    value={checkin2}
                    onChange={setCheckin2}
                  />
                  <TimePicker12Hour
                    label="Check Out 2"
                    value={checkout2}
                    onChange={setCheckout2}
                  />
                </div>

                {/* Description Note */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("description")}</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="សរសេរការបញ្ជាក់បន្ថែមនៅទីនេះ..."
                    className="w-full h-20 py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer resize-none"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-slate-950/40 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedLog(null);
                  }}
                  className="py-2.5 px-5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-khmer cursor-pointer border-none outline-none"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2.5 px-6 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-md shadow-indigo-500/25 font-khmer border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <DocumentArrowUpIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-khmer">
                    {locale === 'kh' ? 'នាំចូលទិន្នន័យវត្តមានតាមរយៈ Excel' : 'Import Attendance Logs via Excel'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {locale === 'kh' ? 'ជ្រើសរើសឯកសារ Excel (.xlsx, .xls) ដើម្បីបញ្ចូលកំណត់ត្រាវត្តមាន' : 'Select an Excel file (.xlsx, .xls) to batch import attendance records'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAttendanceTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer font-khmer"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 text-emerald-400" />
                  <span>{locale === 'kh' ? 'ទាញយកទម្រង់គំរូ' : 'Download Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExcelModal(false);
                    setExcelFile(null);
                    setExcelFileName('');
                    setExcelRows([]);
                    setExcelError('');
                    setExcelImportResult(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer border-none outline-none"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* File Upload Zone */}
              <input
                type="file"
                ref={excelFileInputRef}
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    parseAttendanceExcelFile(e.target.files[0]);
                  }
                }}
              />

              {!excelFileName ? (
                <div
                  onClick={() => excelFileInputRef.current && excelFileInputRef.current.click()}
                  className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/10 hover:bg-emerald-950/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform mb-3">
                    <ArrowUpTrayIcon className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-white font-khmer mb-1">
                    {locale === 'kh' ? 'ចុចទីនេះដើម្បីជ្រើសរើសឯកសារ Excel ឬទម្លាក់ឯកសារនៅទីនេះ' : 'Click to select an Excel file or drag & drop here'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {locale === 'kh' ? 'ទ្រទ្រង់ឯកសារ .xlsx, .xls, .csv' : 'Supports .xlsx, .xls, .csv files'}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Staff ID</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Date</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Check-in 1</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Check-out 1</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Check-in 2</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Check-out 2</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Note</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950/50 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <DocumentArrowUpIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{excelFileName}</p>
                      <p className="text-xs text-slate-400 font-khmer">
                        {locale === 'kh' ? `រកឃើញទិន្នន័យសរុប ${excelRows.length} ជួរ` : `Found ${excelRows.length} records in total`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => excelFileInputRef.current && excelFileInputRef.current.click()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer font-khmer"
                  >
                    {locale === 'kh' ? 'ជ្រើសរើសឯកសារផ្សេង' : 'Change File'}
                  </button>
                </div>
              )}

              {/* Error Message */}
              {excelError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {/* Success Result Message */}
              {excelImportResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm font-khmer">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>
                      {locale === 'kh'
                        ? `បានដំណើរការដោយជោគជ័យចំនួន ${(excelImportResult.insertedCount || 0) + (excelImportResult.updatedCount || 0)} កំណត់ត្រា!`
                        : `Successfully processed ${(excelImportResult.insertedCount || 0) + (excelImportResult.updatedCount || 0)} attendance records!`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                    <span>{locale === 'kh' ? 'បង្កើតថ្មី៖' : 'Inserted:'} <strong className="text-emerald-400">{excelImportResult.insertedCount || 0}</strong></span>
                    <span>{locale === 'kh' ? 'កែប្រែបន្ថែម៖' : 'Updated:'} <strong className="text-indigo-400">{excelImportResult.updatedCount || 0}</strong></span>
                    {excelImportResult.skippedCount > 0 && (
                      <span className="text-amber-400">{locale === 'kh' ? 'រំលង៖' : 'Skipped:'} <strong>{excelImportResult.skippedCount}</strong></span>
                    )}
                  </div>
                  {Array.isArray(excelImportResult.errors) && excelImportResult.errors.length > 0 && (
                    <div className="mt-2 text-[11px] text-slate-400 max-h-24 overflow-y-auto space-y-1 pl-6 list-disc">
                      {excelImportResult.errors.map((err, i) => (
                        <div key={i} className="text-amber-300/80">• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Bar */}
              {excelRows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl">
                    <span className="text-xs text-slate-400 block font-khmer">{locale === 'kh' ? 'ជួរសរុប' : 'Total Rows'}</span>
                    <span className="text-lg font-bold text-white">{excelRows.length}</span>
                  </div>
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                    <span className="text-xs text-emerald-400 block font-khmer">{locale === 'kh' ? 'ត្រៀមបញ្ចូល (ត្រឹមត្រូវ)' : 'Ready to Insert'}</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {excelRows.filter(r => r.isValid).length}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl">
                    <span className="text-xs text-amber-400 block font-khmer">{locale === 'kh' ? 'មានបញ្ហា / មិនស្គាល់' : 'Warnings / Unmatched'}</span>
                    <span className="text-lg font-bold text-amber-400">
                      {excelRows.filter(r => !r.isValid).length}
                    </span>
                  </div>
                </div>
              )}

              {/* Mapping Controls & Header Info */}
              {availableHeaders.length > 0 && (
                <div className="bg-slate-950/40 border border-white/10 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-emerald-400 font-khmer">
                        {locale === 'kh' ? 'ជួរឈរដែលបានចាប់ (Detected Columns):' : 'Detected Columns:'}
                      </span>
                      <span className="text-slate-300 text-[11px]">
                        {availableHeaders.slice(0, 7).join(', ')}{availableHeaders.length > 7 ? '...' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMappingPanel(!showMappingPanel)}
                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-khmer flex items-center gap-1.5"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      <span>{showMappingPanel ? (locale === 'kh' ? 'លាក់ការផ្គូផ្គង' : 'Hide Mapping') : (locale === 'kh' ? 'កែសម្រួលផ្គូផ្គងជួរឈរ (Edit Mapping)' : 'Edit Column Mapping')}</span>
                    </button>
                  </div>

                  {/* Dropdowns for Column Mapping */}
                  {showMappingPanel && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">Staff ID</label>
                        <select
                          value={columnMapping.staffId}
                          onChange={(e) => {
                            const updated = { ...columnMapping, staffId: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">{locale === 'kh' ? 'កាលបរិច្ឆេទ (Date)' : 'Date'}</label>
                        <select
                          value={columnMapping.attendanceDate}
                          onChange={(e) => {
                            const updated = { ...columnMapping, attendanceDate: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">Check In 1</label>
                        <select
                          value={columnMapping.checkin1}
                          onChange={(e) => {
                            const updated = { ...columnMapping, checkin1: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">Check Out 1</label>
                        <select
                          value={columnMapping.checkout1}
                          onChange={(e) => {
                            const updated = { ...columnMapping, checkout1: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">Check In 2</label>
                        <select
                          value={columnMapping.checkin2}
                          onChange={(e) => {
                            const updated = { ...columnMapping, checkin2: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">Check Out 2</label>
                        <select
                          value={columnMapping.checkout2}
                          onChange={(e) => {
                            const updated = { ...columnMapping, checkout2: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1 font-khmer">{locale === 'kh' ? 'កំណត់សម្គាល់ (Note)' : 'Note'}</label>
                        <select
                          value={columnMapping.note}
                          onChange={(e) => {
                            const updated = { ...columnMapping, note: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildAttendanceRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/15 text-white rounded-lg text-xs outline-none"
                        >
                          <option value="">-- {locale === 'kh' ? 'ជ្រើសរើស' : 'Select'} --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Table Preview */}
              {excelRows.length > 0 && (
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-300 font-khmer">
                      {locale === 'kh' ? 'ទិដ្ឋភាពទូទៅនៃទិន្នន័យ (Data Preview)' : 'Data Preview'}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {excelRows.filter(r => r.isValid).length} / {excelRows.length} {locale === 'kh' ? 'ជួរត្រឹមត្រូវ' : 'valid'}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[320px]">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-white/10">
                        <tr>
                          <th className="px-3 py-2 text-center w-12">#</th>
                          <th className="px-3 py-2">Staff ID</th>
                          <th className="px-3 py-2">Employee</th>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">In 1</th>
                          <th className="px-3 py-2">Out 1</th>
                          <th className="px-3 py-2">In 2</th>
                          <th className="px-3 py-2">Out 2</th>
                          <th className="px-3 py-2">Note</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-slate-900/50">
                        {excelRows.map((r, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-white/5 transition-colors ${
                              !r.isValid ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            <td className="px-3 py-2 text-center text-slate-500 font-mono">{r.rowIndex}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-white">{r.staffId || '-'}</td>
                            <td className="px-3 py-2 font-medium text-slate-200">{r.empName || '-'}</td>
                            <td className="px-3 py-2 text-indigo-300">{r.departmentName || '-'}</td>
                            <td className="px-3 py-2 font-mono">{formatDateDDMMYYYY(r.attendanceDate)}</td>
                            <td className="px-3 py-2 text-emerald-400 font-mono">{r.checkin1 || '-'}</td>
                            <td className="px-3 py-2 text-amber-400 font-mono">{r.checkout1 || '-'}</td>
                            <td className="px-3 py-2 text-emerald-400 font-mono">{r.checkin2 || '-'}</td>
                            <td className="px-3 py-2 text-amber-400 font-mono">{r.checkout2 || '-'}</td>
                            <td className="px-3 py-2 text-slate-400 max-w-[140px] truncate">{r.note || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-khmer">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  <span>{locale === 'kh' ? 'ត្រៀម' : 'Ready'}</span>
                                </span>
                              ) : (
                                <span
                                  title={r.warnings.join(', ')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help font-khmer"
                                >
                                  <ExclamationTriangleIcon className="h-3 w-3" />
                                  <span>{r.warnings[0] || (locale === 'kh' ? 'ព្រមាន' : 'Warning')}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-950/80 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400 font-khmer">
                {excelRows.length > 0 && !excelImportResult && (
                  <span>
                    {locale === 'kh'
                      ? `មានទិន្នន័យត្រឹមត្រូវ ${excelRows.filter(r => r.isValid).length} កំណត់ត្រា ត្រៀមបញ្ចូល`
                      : `${excelRows.filter(r => r.isValid).length} valid attendance record(s) ready to insert`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowExcelModal(false);
                    setExcelFile(null);
                    setExcelFileName('');
                    setExcelRows([]);
                    setExcelError('');
                    setExcelImportResult(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer font-khmer border-none"
                >
                  {excelImportResult ? (locale === 'kh' ? 'រួចរាល់ / បិទ' : 'Done / Close') : t('cancel')}
                </button>

                {/* THE INSERT ALL BUTTON */}
                <button
                  type="button"
                  id="btn-insert-all-attendance"
                  onClick={handleInsertAllAttendance}
                  disabled={
                    excelImportLoading ||
                    excelRows.filter(r => r.isValid).length === 0 ||
                    excelImportResult !== null
                  }
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-500/25 font-khmer cursor-pointer border-none outline-none"
                >
                  {excelImportLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{locale === 'kh' ? 'កំពុងបញ្ចូល...' : 'Inserting...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>
                        {locale === 'kh'
                          ? `Insert all (${excelRows.filter(r => r.isValid).length})`
                          : `Insert all (${excelRows.filter(r => r.isValid).length})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
