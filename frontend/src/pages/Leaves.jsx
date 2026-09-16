import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const Leaves = () => {
  const { user } = useAuth();
  const { t, getLocalizedName, locale } = useLanguage();
  const canApprove = ['Admin', 'HR', 'Manager'].includes(user?.role);
  const canImport = ['Admin', 'HR'].includes(user?.role);
  const showActions = canApprove || user?.role === 'Employee';

  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Excel Import State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelRows, setExcelRows] = useState([]);
  const [excelError, setExcelError] = useState('');
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState(null);
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [rawSheetData, setRawSheetData] = useState([]);
  const excelFileInputRef = useRef(null);

  // Filters State
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState('requestDate'); // 'requestDate' | 'leaveDate'
  const [sortBy, setSortBy] = useState('leaveDate'); // 'leaveDate' | 'requestedAt'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'

  // Request Form State
  const [selectedStaffId, setSelectedStaffId] = useState(user?.staffId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationType, setDurationType] = useState('Full Day');
  const [leaveType, setLeaveType] = useState('AL');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const getEmployeePhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get('/leave-types');
      setLeaveTypes(res.data);
      if (res.data.length > 0) {
        setLeaveType(res.data[0].code);
      }
    } catch (err) {
      console.error('Error fetching leave types:', err);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
    fetchEmployees();
  }, []);

  const getLeaveTypeLabel = (code) => {
    const type = leaveTypes.find(t => t.code === code || t.nameEn === code);
    if (type) {
      return getLocalizedName(type.nameEn, type.nameKh);
    }
    if (code === 'Annual Leave') return t("annualLeave");
    if (code === 'Sick Leave') return t("sickLeave");
    if (code === 'Personal Leave') return t("personalLeave");
    return code;
  };

  const getCreatorDisplayName = (creatorVal) => {
    if (!creatorVal) return '-';
    const emp = employees.find(
      e => e.staffId?.toLowerCase() === String(creatorVal).toLowerCase() ||
           e.email?.toLowerCase() === String(creatorVal).toLowerCase() ||
           e.nameEn?.toLowerCase() === String(creatorVal).toLowerCase()
    );
    if (emp) {
      return getLocalizedName(emp.nameEn, emp.nameKh);
    }
    return creatorVal;
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      let query = `?status=${filterStatus}&search=${encodeURIComponent(search)}`;
      if (filterFromDate) query += `&startDate=${filterFromDate}`;
      if (filterToDate) query += `&endDate=${filterToDate}`;
      if (dateFilterType) query += `&dateType=${dateFilterType}`;

      const response = await api.get(`/leaves${query}`);
      setLeaves(response.data || []);
    } catch (error) {
      console.error('Error loading leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus, search, filterFromDate, filterToDate, dateFilterType]);

  // Client-side date filter and sorting ensuring instantaneous accuracy
  const displayLeaves = useMemo(() => {
    const filtered = leaves.filter(leave => {
      if (filterFromDate) {
        const target = dateFilterType === 'leaveDate'
          ? (leave.leaveDate ? leave.leaveDate.split('T')[0] : '')
          : (leave.requestedAt ? leave.requestedAt.split('T')[0] : (leave.createdAt ? leave.createdAt.split('T')[0] : (leave.leaveDate ? leave.leaveDate.split('T')[0] : '')));
        if (target && target < filterFromDate) return false;
      }
      if (filterToDate) {
        const target = dateFilterType === 'leaveDate'
          ? (leave.leaveDate ? leave.leaveDate.split('T')[0] : '')
          : (leave.requestedAt ? leave.requestedAt.split('T')[0] : (leave.createdAt ? leave.createdAt.split('T')[0] : (leave.leaveDate ? leave.leaveDate.split('T')[0] : '')));
        if (target && target > filterToDate) return false;
      }
      return true;
    });

    // Sort by selected date (default: leaveDate descending - newest date first)
    return [...filtered].sort((a, b) => {
      let timeA = 0;
      let timeB = 0;
      if (sortBy === 'leaveDate') {
        timeA = a.leaveDate ? new Date(a.leaveDate).getTime() : 0;
        timeB = b.leaveDate ? new Date(b.leaveDate).getTime() : 0;
      } else {
        timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      }

      if (timeA !== timeB) {
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }

      // Tie breaker by the other date
      const subA = a.requestedAt ? new Date(a.requestedAt).getTime() : (a.leaveDate ? new Date(a.leaveDate).getTime() : 0);
      const subB = b.requestedAt ? new Date(b.requestedAt).getTime() : (b.leaveDate ? new Date(b.leaveDate).getTime() : 0);
      return sortOrder === 'desc' ? subB - subA : subA - subB;
    });
  }, [leaves, filterFromDate, filterToDate, dateFilterType, sortBy, sortOrder]);

  const handleOpenRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedStaffId(user?.staffId || (employees.length > 0 ? employees[0].staffId : ''));
    setStartDate(today);
    setEndDate(today);
    setDurationType('Full Day');
    if (leaveTypes.length > 0) {
      setLeaveType(leaveTypes[0].code);
    } else {
      setLeaveType('AL');
    }
    setReason('');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !leaveType || !durationType) {
      setErrorMsg('Required fields are missing');
      return;
    }

    const targetStaffId = ['Admin', 'HR', 'Manager'].includes(user?.role) && selectedStaffId
      ? selectedStaffId
      : user.staffId;

    const creator = getLocalizedName(user?.nameEn, user?.nameKh) || user?.nameEn || user?.staffId || '';

    try {
      await api.post('/leaves', {
        staffId: targetStaffId,
        startDate,
        endDate,
        durationType,
        leaveType,
        reason,
        createdBy: creator
      });
      setShowModal(false);
      fetchLeaves();
    } catch (error) {
      console.error('Error submitting leave:', error);
      setErrorMsg(error.response?.data?.message || 'Error submitting leave');
    }
  };

  const handleDecision = async (id, status) => {
    try {
      await api.put(`/leaves/${id}/status`, {
        status,
        managerName: getLocalizedName(user.nameEn, user.nameKh)
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error making leave decision:', error);
      alert(error.response?.data?.message || 'Error executing action');
    }
  };

  const handleDeleteLeave = async (id) => {
    const confirmMsg = locale === 'kh'
      ? 'តើអ្នកប្រាកដជាចង់លុបសំណើសុំច្បាប់នេះមែនទេ? ចំនួនថ្ងៃច្បាប់នឹងត្រូវ Rollback ត្រឡប់មកវិញ។'
      : 'Are you sure you want to delete this leave request? The leave days will be rolled back.';
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.delete(`/leaves/${id}`);
      fetchLeaves();
    } catch (error) {
      console.error('Error deleting leave:', error);
      alert(error.response?.data?.message || (locale === 'kh' ? 'មានបញ្ហាក្នុងការលុបច្បាប់' : 'Error deleting leave'));
    }
  };

  const handleExportExcel = () => {
    if (leaves.length === 0) {
      alert(locale === 'kh' ? 'មិនមានទិន្នន័យច្បាប់សម្រាកសម្រាប់ Export ឡើយ!' : 'No leave records to export!');
      return;
    }

    const todayStr = formatDateDDMMYYYY(new Date());
    const title = `Leave Requests Report (${todayStr})`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Leave Requests</x:Name>
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
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; }
          table.report-table th { border: 1px solid #000000; background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: left; padding: 6px 10px; font-size: 10pt; }
          table.report-table td { border: 1px solid #000000; padding: 6px 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
          <tr>
            <td colspan="13" class="title-row" style="font-size:14pt; font-weight:bold; text-align:center; height:35px;">
              ${title}
            </td>
          </tr>
          <tr>
            <td colspan="13" style="text-align:center; font-size:9pt; color:#64748b; height:20px;">
              Exported: ${new Date().toLocaleString()} | Filter Status: ${filterStatus || 'All'} | Total Records: ${leaves.length}
            </td>
          </tr>
        </table>

        <table class="report-table" border="1" style="border-collapse:collapse; width:100%; border:1px solid #000000;">
          <thead>
            <tr style="background-color:#1e293b; color:#ffffff;">
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:45px; text-align:center;">No</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:100px;">Staff ID</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Name (EN)</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Name (KH)</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Department</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Position</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px; text-align:center;">Leave Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px; text-align:center;">Request Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Leave Type</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:90px; text-align:center;">Days</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:220px;">Reason</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:100px; text-align:center;">Status</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Manager Name</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Created By</th>
            </tr>
          </thead>
          <tbody>
    `;

    displayLeaves.forEach((leave, idx) => {
      const emp = employees.find(e => e.staffId === leave.staffId) || leave.employee || {};
      const deptName = emp.department ? (emp.department.nameEn || '') : '';
      const posTitle = emp.position ? (emp.position.titleEn || '') : '';
      const typeLabel = getLeaveTypeLabel(leave.leaveType);
      const creatorName = getCreatorDisplayName(leave.createdBy || leave.staffId);
      const dateDisplay = formatDateDDMMYYYY(leave.leaveDate);
      const reqDateDisplay = formatDateDDMMYYYY(leave.requestedAt || leave.createdAt);
      const days = parseFloat(leave.amountDays || 0).toFixed(1);

      let statusBg = '#fef3c7';
      let statusColor = '#b45309';
      if (leave.status === 'Approved') {
        statusBg = '#d1fae5';
        statusColor = '#047857';
      } else if (leave.status === 'Rejected') {
        statusBg = '#ffe4e6';
        statusColor = '#be123c';
      }

      excelHTML += `
        <tr>
          <td style="border:1px solid #000000; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000000; font-weight:bold;">${leave.staffId || emp.staffId || '-'}</td>
          <td style="border:1px solid #000000;">${emp.nameEn || ''}</td>
          <td style="border:1px solid #000000;">${emp.nameKh || ''}</td>
          <td style="border:1px solid #000000;">${deptName}</td>
          <td style="border:1px solid #000000;">${posTitle}</td>
          <td style="border:1px solid #000000; text-align:center;">${dateDisplay}</td>
          <td style="border:1px solid #000000; text-align:center;">${reqDateDisplay}</td>
          <td style="border:1px solid #000000;">${typeLabel}</td>
          <td style="border:1px solid #000000; text-align:center; font-weight:bold;">${days}</td>
          <td style="border:1px solid #000000;">${leave.reason || '-'}</td>
          <td style="border:1px solid #000000; text-align:center; font-weight:bold; background-color:${statusBg}; color:${statusColor};">${leave.status || 'Pending'}</td>
          <td style="border:1px solid #000000;">${leave.managerName || '-'}</td>
          <td style="border:1px solid #000000;">${creatorName || '-'}</td>
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
    const filterTag = filterStatus ? `_${filterStatus}` : '';
    link.setAttribute('download', `Leave_Requests${filterTag}_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const detectLeaveCol = (colName) => {
    if (!colName) return null;
    const clean = String(colName).trim().toLowerCase().replace(/[\s_-]+/g, '');

    // Staff ID
    if (
      clean.includes('staffid') ||
      clean.includes('empid') ||
      clean.includes('employeeid') ||
      clean.includes('staff') ||
      clean.includes('អត្តលេខ') ||
      clean.includes('លេខសម្គាល់') ||
      clean.includes('កូដបុគ្គលិក') ||
      clean.includes('កូដ')
    ) {
      return 'staffId';
    }

    // Leave Type
    if (
      clean.includes('leavetype') ||
      clean.includes('type') ||
      clean.includes('ប្រភេទច្បាប់') ||
      clean.includes('ច្បាប់')
    ) {
      return 'leaveType';
    }

    // End Date
    if (
      clean.includes('enddate') ||
      clean.includes('todate') ||
      clean.includes('until') ||
      clean.includes('ថ្ងៃបញ្ចប់') ||
      clean.includes('ដល់ថ្ងៃ')
    ) {
      return 'endDate';
    }

    // Leave Date / Start Date
    if (
      clean.includes('leavedate') ||
      clean.includes('startdate') ||
      clean.includes('fromdate') ||
      clean.includes('date') ||
      clean.includes('day') ||
      clean.includes('ថ្ងៃច្បាប់') ||
      clean.includes('កាលបរិច្ឆេទ') ||
      clean.includes('ថ្ងៃចាប់ផ្តើម') ||
      clean.includes('ថ្ងៃ')
    ) {
      return 'leaveDate';
    }

    // Duration Type (Full Day / Morning / Afternoon)
    if (
      clean.includes('duration') ||
      clean.includes('session') ||
      clean.includes('shift') ||
      clean.includes('period') ||
      clean.includes('ពេល') ||
      clean.includes('វេន') ||
      clean.includes('រយៈពេល')
    ) {
      return 'durationType';
    }

    // Amount Days
    if (
      clean.includes('amount') ||
      clean.includes('days') ||
      clean.includes('daycount') ||
      clean.includes('qty') ||
      clean.includes('ចំនួនថ្ងៃ')
    ) {
      return 'amountDays';
    }

    // Reason
    if (
      clean.includes('reason') ||
      clean.includes('remark') ||
      clean.includes('note') ||
      clean.includes('comment') ||
      clean.includes('មូលហេតុ') ||
      clean.includes('កំណត់សម្គាល់') ||
      clean.includes('ផ្សេងៗ')
    ) {
      return 'reason';
    }

    // Status
    if (
      clean.includes('status') ||
      clean.includes('ស្ថានភាព')
    ) {
      return 'status';
    }

    return null;
  };

  const formatDateForBackend = (val) => {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val)) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
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
    const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  };

  const applyMappingAndBuildLeaveRows = (data, hIdx, mapping) => {
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
    const idxLeaveDate = getColIndex('leaveDate');
    const idxEndDate = getColIndex('endDate');
    const idxLeaveType = getColIndex('leaveType');
    const idxDuration = getColIndex('durationType');
    const idxDays = getColIndex('amountDays');
    const idxReason = getColIndex('reason');
    const idxStatus = getColIndex('status');

    const dataRows = data.slice(hIdx + 1);
    const processed = [];

    dataRows.forEach((row) => {
      if (!Array.isArray(row)) return;
      const hasContent = row.some(cell => String(cell || '').trim() !== '');
      if (!hasContent) return;

      const getVal = (idx) => (idx >= 0 && idx < row.length ? row[idx] : '');

      let rawStaffId = String(getVal(idxStaffId) || '').trim();
      let rawLeaveDate = getVal(idxLeaveDate);
      let rawEndDate = getVal(idxEndDate);
      let rawLeaveType = String(getVal(idxLeaveType) || '').trim();
      let rawDuration = String(getVal(idxDuration) || '').trim();
      let rawDays = getVal(idxDays);
      let rawReason = String(getVal(idxReason) || '').trim();
      let rawStatus = String(getVal(idxStatus) || '').trim();

      const warnings = [];

      // 1. Staff ID validation
      if (!rawStaffId) {
        warnings.push(locale === 'kh' ? 'ខ្វះ Staff ID' : 'Missing Staff ID');
      }
      let matchedEmp = null;
      if (rawStaffId) {
        const lower = rawStaffId.toLowerCase();
        matchedEmp = employees.find(e => e.staffId && e.staffId.toLowerCase() === lower);
        if (!matchedEmp) {
          warnings.push(locale === 'kh' ? `រកមិនឃើញបុគ្គលិក (${rawStaffId})` : `Employee not found (${rawStaffId})`);
        } else {
          rawStaffId = matchedEmp.staffId;
        }
      }

      // 2. Date validation
      const formattedDate = formatDateForBackend(rawLeaveDate);
      if (!formattedDate) {
        warnings.push(locale === 'kh' ? 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ' : 'Invalid leave date');
      }

      let formattedEndDate = formatDateForBackend(rawEndDate);
      if (formattedEndDate && formattedDate && formattedEndDate < formattedDate) {
        warnings.push(locale === 'kh' ? 'ថ្ងៃបញ្ចប់មុនថ្ងៃចាប់ផ្តើម' : 'End date is before start date');
      }

      // 3. Leave Type normalization
      let resolvedTypeCode = 'AL';
      if (rawLeaveType) {
        const lowerLT = rawLeaveType.toLowerCase();
        const foundLT = leaveTypes.find(
          lt => (lt.code && lt.code.toLowerCase() === lowerLT) ||
                (lt.nameEn && lt.nameEn.toLowerCase() === lowerLT) ||
                (lt.nameKh && lt.nameKh.toLowerCase() === lowerLT)
        );
        if (foundLT) {
          resolvedTypeCode = foundLT.code;
        } else if (lowerLT.includes('sick') || lowerLT.includes('ឈឺ') || lowerLT === 'sl') {
          resolvedTypeCode = 'SL';
        } else if (lowerLT.includes('person') || lowerLT.includes('ផ្ទាល់ខ្លួន') || lowerLT === 'pl') {
          resolvedTypeCode = 'PL';
        } else if (lowerLT.includes('annual') || lowerLT.includes('ប្រចាំឆ្នាំ') || lowerLT === 'al') {
          resolvedTypeCode = 'AL';
        } else {
          resolvedTypeCode = rawLeaveType;
        }
      }

      // 4. Duration Type normalization
      let resolvedDuration = 'Full Day';
      const lowerDur = rawDuration.toLowerCase();
      if (lowerDur.includes('morn') || lowerDur.includes('ព្រឹក')) {
        resolvedDuration = 'Morning';
      } else if (lowerDur.includes('after') || lowerDur.includes('រសៀល')) {
        resolvedDuration = 'Afternoon';
      }

      // 5. Amount of Days
      let resolvedDays = resolvedDuration === 'Full Day' ? 1.0 : 0.5;
      if (rawDays !== undefined && rawDays !== '' && rawDays !== null) {
        const parsedD = parseFloat(rawDays);
        if (!isNaN(parsedD) && parsedD > 0) {
          resolvedDays = parsedD;
        }
      } else if (formattedEndDate && formattedDate && formattedEndDate !== formattedDate) {
        const diffMs = new Date(formattedEndDate).getTime() - new Date(formattedDate).getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 0) {
          resolvedDays = diffDays * (resolvedDuration === 'Full Day' ? 1.0 : 0.5);
        }
      }

      // 6. Status normalization
      let resolvedStatus = 'Approved';
      const lowerSt = rawStatus.toLowerCase();
      if (lowerSt.includes('pend') || lowerSt.includes('រង់ចាំ')) {
        resolvedStatus = 'Pending';
      } else if (lowerSt.includes('reject') || lowerSt.includes('បដិសេធ')) {
        resolvedStatus = 'Rejected';
      }

      processed.push({
        rowIndex: processed.length + 1,
        staffId: rawStaffId,
        empName: matchedEmp ? getLocalizedName(matchedEmp.nameEn, matchedEmp.nameKh) : '-',
        leaveDate: formattedDate,
        endDate: formattedEndDate || formattedDate,
        leaveType: resolvedTypeCode,
        durationType: resolvedDuration,
        amountDays: resolvedDays,
        reason: rawReason,
        status: resolvedStatus,
        isValid: warnings.length === 0,
        warnings
      });
    });

    setExcelRows(processed);
  };

  const parseLeaveExcelFile = (file) => {
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
          'staff', 'id', 'code', 'emp', 'date', 'leave', 'type', 'duration', 'day', 'reason', 'status',
          'អត្តលេខ', 'លេខសម្គាល់', 'កូដ', 'កាលបរិច្ឆេទ', 'ថ្ងៃ', 'ច្បាប់', 'ប្រភេទច្បាប់', 'រយៈពេល', 'មូលហេតុ', 'ស្ថានភាព'
        ];

        let bestHeaderIdx = 0;
        let maxScore = -1;

        for (let r = 0; r < Math.min(sheetData.length, 15); r++) {
          const row = sheetData[r];
          if (!Array.isArray(row) || row.length === 0) continue;

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
          leaveDate: '',
          endDate: '',
          leaveType: '',
          durationType: '',
          amountDays: '',
          reason: '',
          status: ''
        };

        detectedColList.forEach(colName => {
          const matchedField = detectLeaveCol(colName);
          if (matchedField && !newMapping[matchedField]) {
            newMapping[matchedField] = colName;
          }
        });

        // Content-based fallback inspection for staffId
        const sampleRows = sheetData.slice(bestHeaderIdx + 1, bestHeaderIdx + 26)
          .filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));

        if (!newMapping.staffId) {
          detectedColList.forEach((colName, cIdx) => {
            let matchCount = 0;
            sampleRows.forEach(row => {
              const val = String(row[cIdx] || '').trim().toLowerCase();
              if (employees.some(e => e.staffId && e.staffId.toLowerCase() === val)) {
                matchCount++;
              }
            });
            if (matchCount > 0 && !newMapping.staffId) {
              newMapping.staffId = colName;
            }
          });
        }

        setColumnMapping(newMapping);
        applyMappingAndBuildLeaveRows(sheetData, bestHeaderIdx, newMapping);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setExcelError(locale === 'kh' ? 'មានបញ្ហាក្នុងការអានឯកសារ Excel' : 'Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadLeaveTemplate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sampleStaff1 = employees[0]?.staffId || 'EMP-001';
    const sampleStaff2 = employees[1]?.staffId || 'EMP-002';
    const sampleName1 = employees[0]?.nameEn || 'Khoem Piseth';
    const sampleName2 = employees[1]?.nameEn || 'Keo Sophea';

    const templateData = [
      {
        'Staff ID': sampleStaff1,
        'Employee Name': sampleName1,
        'Leave Date': todayStr,
        'End Date': todayStr,
        'Leave Type': 'AL',
        'Duration': 'Full Day',
        'Days': 1,
        'Reason': 'Family vacation',
        'Status': 'Approved'
      },
      {
        'Staff ID': sampleStaff2,
        'Employee Name': sampleName2,
        'Leave Date': todayStr,
        'End Date': todayStr,
        'Leave Type': 'SL',
        'Duration': 'Morning',
        'Days': 0.5,
        'Reason': 'Morning doctor appointment',
        'Status': 'Approved'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leave_Template');
    XLSX.writeFile(wb, 'Leave_Import_Template.xlsx');
  };

  const handleInsertAllLeaves = async () => {
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
        leaveDate: r.leaveDate,
        endDate: r.endDate || r.leaveDate,
        leaveType: r.leaveType,
        durationType: r.durationType,
        amountDays: r.amountDays,
        reason: r.reason,
        status: r.status,
        createdBy: getLocalizedName(user?.nameEn, user?.nameKh) || user?.nameEn || 'Admin'
      }));

      const res = await api.post('/leaves/batch', payload);
      setExcelImportResult(res.data);
      await fetchLeaves();
    } catch (err) {
      console.error('Error importing leaves:', err);
      setExcelError(err.response?.data?.message || (locale === 'kh' ? 'មានបញ្ហាក្នុងការបញ្ចូលទិន្នន័យច្បាប់' : 'Failed to import leave records'));
    } finally {
      setExcelImportLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("requestItem")}</h2>
          <p className="text-slate-400 text-xs mt-1">Submit requests and manage approvals</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={leaves.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
            title="Export leave requests to Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
          {canImport && (
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
              title="Import leaves from Excel"
            >
              <ArrowUpTrayIcon className="h-4 w-4 stroke-[2.5]" />
              <span>{locale === 'kh' ? 'នាំចូល Excel' : 'Import Excel'}</span>
            </button>
          )}
          <button
            onClick={handleOpenRequestModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none flex-1 sm:flex-initial justify-center"
          >
            <PlusIcon className="h-5 w-5" />
            {t("requestLeave")}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-5 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          {/* Search */}
          {user.role !== 'Employee' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t("search")}</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={locale === 'kh' ? 'ស្វែងរកឈ្មោះ, ID, មូលហេតុ...' : 'Search name, ID, reason...'}
                className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
          )}

          {/* Status selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t("status")}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{t("status")} ({t("all")})</option>
              <option value="Pending" className="bg-slate-900">{t("pending")}</option>
              <option value="Approved" className="bg-slate-900">{t("approved")}</option>
              <option value="Rejected" className="bg-slate-900">{t("rejected")}</option>
            </select>
          </div>

          {/* Date Filter Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">
              {locale === 'kh' ? 'ស្វែងរកតាមថ្ងៃ' : 'Filter Date By'}
            </label>
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="requestDate" className="bg-slate-900">{locale === 'kh' ? 'ថ្ងៃស្នើសុំ (Request Date)' : 'Request Date'}</option>
              <option value="leaveDate" className="bg-slate-900">{locale === 'kh' ? 'ថ្ងៃសុំច្បាប់ (Leave Date)' : 'Leave Date'}</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">
              {t("fromDate")}
            </label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all text-slate-200"
            />
          </div>

          {/* To Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-400 font-khmer">{t("toDate")}</label>
              {(filterFromDate || filterToDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-khmer transition-colors cursor-pointer"
                >
                  {locale === 'kh' ? 'សម្អាតថ្ងៃ' : 'Clear Dates'}
                </button>
              )}
            </div>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Leaves list table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap w-16 text-center">{t("noNumber")}</th>
                  {user.role !== 'Employee' && <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("employees")}</th>}
                  <th
                    onClick={() => {
                      if (sortBy === 'leaveDate') {
                        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortBy('leaveDate');
                        setSortOrder('desc');
                      }
                    }}
                    className="py-4 px-6 font-khmer whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none"
                    title={locale === 'kh' ? 'ចុចដើម្បីតម្រៀបតាមថ្ងៃសុំច្បាប់' : 'Click to sort by Leave Date'}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{t("leaveDate")}</span>
                      {sortBy === 'leaveDate' ? (
                        <span className="text-indigo-400 font-bold">{sortOrder === 'desc' ? '▼' : '▲'}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">⇅</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'requestedAt') {
                        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortBy('requestedAt');
                        setSortOrder('desc');
                      }
                    }}
                    className="py-4 px-6 font-khmer whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none"
                    title={locale === 'kh' ? 'ចុចដើម្បីតម្រៀបតាមថ្ងៃស្នើសុំ' : 'Click to sort by Request Date'}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{locale === 'kh' ? 'ថ្ងៃស្នើសុំ' : 'Request Date'}</span>
                      {sortBy === 'requestedAt' ? (
                        <span className="text-indigo-400 font-bold">{sortOrder === 'desc' ? '▼' : '▲'}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">⇅</span>
                      )}
                    </div>
                  </th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("leaveType")}</th>
                  <th className="py-4 px-6 text-center font-khmer whitespace-nowrap">{t("amountDays")}</th>
                  <th className="py-4 px-6 font-khmer">{t("reason")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("status")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("managerName")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("createdBy")}</th>
                  {showActions && <th className="py-4 px-6 text-right font-khmer whitespace-nowrap min-w-[110px]">{t("actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={9 + (user.role !== 'Employee' ? 1 : 0) + (showActions ? 1 : 0)} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  displayLeaves.map((leave, index) => {
                    const emp = employees.find(e => e.staffId === leave.staffId) || leave.employee;
                    const photo = getEmployeePhoto(emp);
                    const nameEn = emp?.nameEn || leave.staffId;
                    const nameKh = emp?.nameKh || '';
                    const deptName = emp?.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '';
                    const posTitle = emp?.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '';

                    return (
                      <tr key={leave.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-center font-semibold text-slate-400 whitespace-nowrap font-mono">
                          {index + 1}
                        </td>
                        {user.role !== 'Employee' && (
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {photo ? (
                                <img
                                  src={photo}
                                  alt={nameEn}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                                  {nameEn?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">
                                  {getLocalizedName(nameEn, nameKh)}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">
                                  ID: <span className="text-indigo-400 font-semibold">{leave.staffId}</span>
                                  {emp?.role && <span> • {emp.role}</span>}
                                </p>
                                {(deptName || posTitle) && (
                                  <p className="text-xs font-semibold text-indigo-400">
                                    {[deptName, posTitle].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="py-4 px-6 font-semibold text-white whitespace-nowrap">
                          {formatDateDDMMYYYY(leave.leaveDate)}
                        </td>
                        <td className="py-4 px-6 text-slate-300 whitespace-nowrap font-mono text-xs">
                          {formatDateDDMMYYYY(leave.requestedAt || leave.createdAt)}
                        </td>
                        <td className="py-4 px-6 font-khmer whitespace-nowrap">
                          {getLeaveTypeLabel(leave.leaveType)}
                        </td>
                        <td className="py-4 px-6 text-center font-semibold text-white whitespace-nowrap">
                          {parseFloat(leave.amountDays).toFixed(1)}
                        </td>
                        <td className="py-4 px-6 max-w-xs truncate text-slate-300">{leave.reason || '-'}</td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-khmer ring-1 ${leave.status === 'Approved'
                              ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                              : leave.status === 'Rejected'
                                ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
                                : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                              }`}
                          >
                            {leave.status === 'Approved' ? t("approved") : leave.status === 'Rejected' ? t("rejected") : t("pending")}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-khmer text-slate-300 whitespace-nowrap">{leave.managerName || '-'}</td>
                        <td className="py-4 px-6 font-khmer text-slate-300 whitespace-nowrap">{getCreatorDisplayName(leave.createdBy || leave.staffId)}</td>
                        {showActions && (
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              {canApprove && leave.status === 'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(leave.id, 'Approved')}
                                    className="inline-flex items-center justify-center p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 rounded-xl transition-colors border border-emerald-500/20 cursor-pointer shadow-sm"
                                    title={t("approve")}
                                  >
                                    <CheckIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(leave.id, 'Rejected')}
                                    className="inline-flex items-center justify-center p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 rounded-xl transition-colors border border-rose-500/20 cursor-pointer shadow-sm"
                                    title={t("reject")}
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}

                              {(canApprove || (user.role === 'Employee' && leave.status === 'Pending' && leave.staffId === user.staffId)) ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLeave(leave.id)}
                                  className="inline-flex items-center justify-center p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 rounded-xl transition-colors border border-rose-500/20 cursor-pointer shadow-sm"
                                  title={locale === 'kh' ? 'លុបច្បាប់ (Rollback)' : 'Delete Leave (Rollback)'}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500 italic font-khmer">-</span>
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
      </div>

      {/* Submission Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 py-10">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10">
              <h3 className="font-bold text-white font-khmer">
                {t("requestLeave")}
              </h3>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center">
                  {errorMsg}
                </div>
              )}

              {/* Employee selector for Admin/HR/Manager */}
              {['Admin', 'HR', 'Manager'].includes(user?.role) && employees.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t("employees")} <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.staffId} value={emp.staffId} className="bg-slate-900">
                        {emp.staffId} - {getLocalizedName(emp.nameEn, emp.nameKh)}
                      </option>
                    ))}
                  </select>

                  {/* Selected employee card preview */}
                  {(() => {
                    const selectedEmp = employees.find(e => e.staffId === selectedStaffId);
                    if (!selectedEmp) return null;
                    const photo = getEmployeePhoto(selectedEmp);
                    const nameEn = selectedEmp.nameEn || selectedEmp.staffId;
                    const nameKh = selectedEmp.nameKh || '';
                    const deptName = selectedEmp.department ? getLocalizedName(selectedEmp.department.nameEn, selectedEmp.department.nameKh) : '';
                    const posTitle = selectedEmp.position ? getLocalizedName(selectedEmp.position.titleEn, selectedEmp.position.titleKh) : '';

                    return (
                      <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/40 border border-white/5">
                        {photo ? (
                          <img
                            src={photo}
                            alt={nameEn}
                            className="w-9 h-9 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-md">
                            {nameEn?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-xs font-semibold font-khmer truncate">
                            {getLocalizedName(nameEn, nameKh)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: <span className="text-indigo-400 font-semibold">{selectedEmp.staffId}</span>
                            {selectedEmp.role ? ` • ${selectedEmp.role}` : ''}
                          </div>
                          {(deptName || posTitle) && (
                            <div className="text-[10px] text-indigo-400 truncate">
                              {[deptName, posTitle].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    ថ្ងៃចាប់ផ្ដើម (Start Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    ថ្ងៃបញ្ចប់ (End Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  រយៈពេលក្នុងមួយថ្ងៃ (Duration Per Day) *
                </label>
                <select
                  value={durationType}
                  onChange={(e) => setDurationType(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  <option value="Full Day" className="bg-slate-900"> Full Day</option>
                  <option value="Morning" className="bg-slate-900"> Morning</option>
                  <option value="Afternoon" className="bg-slate-900"> Afternoon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("leaveType")} *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.code} className="bg-slate-900">
                      {getLocalizedName(type.nameEn, type.nameKh)}
                    </option>
                  ))}
                  {leaveTypes.length === 0 && (
                    <>
                      <option value="Annual Leave" className="bg-slate-900">{t("annualLeave")}</option>
                      <option value="Sick Leave" className="bg-slate-900">{t("sickLeave")}</option>
                      <option value="Personal Leave" className="bg-slate-900">{t("personalLeave")}</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("reason")}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason for request..."
                  rows={3}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none"
                >
                  {t("submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ArrowUpTrayIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-khmer">
                    {locale === 'kh' ? 'នាំចូលទិន្នន័យច្បាប់សម្រាកតាមរយៈ Excel' : 'Import Leave Records via Excel'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {locale === 'kh' ? 'ជ្រើសរើសឯកសារ Excel (.xlsx, .xls, .csv) ដើម្បីបញ្ចូលសំណើសុំច្បាប់ជាដុំ' : 'Select an Excel file (.xlsx, .xls, .csv) to batch import leave records'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadLeaveTemplate}
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
                    parseLeaveExcelFile(e.target.files[0]);
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
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Leave Date</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">End Date</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Leave Type</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Duration</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Days</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Reason</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/5">Status</span>
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
                        ? `បានដំណើរការដោយជោគជ័យចំនួន ${(excelImportResult.insertedCount || 0) + (excelImportResult.updatedCount || 0)} កំណត់ត្រាច្បាប់!`
                        : `Successfully processed ${(excelImportResult.insertedCount || 0) + (excelImportResult.updatedCount || 0)} leave records!`}
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

              {/* Column Mapping Selectors */}
              {availableHeaders.length > 0 && (
                <div className="bg-slate-950/40 border border-white/10 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-emerald-400 font-khmer">
                        {locale === 'kh' ? 'ការផ្គូផ្គងជួរឈរ (Column Mapping)' : 'Column Mapping'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[
                      { key: 'staffId', label: 'Staff ID', required: true },
                      { key: 'leaveDate', label: 'Leave Date', required: true },
                      { key: 'endDate', label: 'End Date (Optional)', required: false },
                      { key: 'leaveType', label: 'Leave Type', required: false },
                      { key: 'durationType', label: 'Duration', required: false },
                      { key: 'amountDays', label: 'Amount Days', required: false },
                      { key: 'reason', label: 'Reason', required: false },
                      { key: 'status', label: 'Status', required: false },
                    ].map(f => (
                      <div key={f.key} className="space-y-1">
                        <label className="block text-slate-400 text-[11px] font-medium">
                          {f.label} {f.required && <span className="text-rose-400">*</span>}
                        </label>
                        <select
                          value={columnMapping[f.key] || ''}
                          onChange={(e) => {
                            const updated = { ...columnMapping, [f.key]: e.target.value };
                            setColumnMapping(updated);
                            applyMappingAndBuildLeaveRows(rawSheetData, headerRowIdx, updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-emerald-500 outline-none"
                        >
                          <option value="">-- None --</option>
                          {availableHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {excelRows.length > 0 && (
                <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/30">
                  <div className="max-h-72 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase font-khmer sticky top-0 border-b border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Staff ID</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'ឈ្មោះ' : 'Employee'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'ប្រភេទច្បាប់' : 'Type'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'រយៈពេល' : 'Duration'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'ថ្ងៃ' : 'Days'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'មូលហេតុ' : 'Reason'}</th>
                          <th className="py-2.5 px-3">{locale === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                          <th className="py-2.5 px-3 text-center">{locale === 'kh' ? 'សុពលភាព' : 'Valid'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {excelRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={`hover:bg-white/5 transition-colors ${!r.isValid ? 'bg-rose-500/5' : ''}`}>
                            <td className="py-2 px-3 text-slate-500">{r.rowIndex}</td>
                            <td className="py-2 px-3 font-semibold text-white">{r.staffId}</td>
                            <td className="py-2 px-3 text-slate-300">{r.empName}</td>
                            <td className="py-2 px-3 text-slate-300">
                              {r.leaveDate}
                              {r.endDate && r.endDate !== r.leaveDate && (
                                <span className="text-slate-500 block text-[10px]">~ {r.endDate}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                                {r.leaveType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{r.durationType}</td>
                            <td className="py-2 px-3 font-semibold text-emerald-400">{r.amountDays}</td>
                            <td className="py-2 px-3 text-slate-400 truncate max-w-[150px]">{r.reason || '-'}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                r.status === 'Approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : r.status === 'Pending'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                                  <CheckCircleIcon className="h-4 w-4" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]" title={r.warnings.join(', ')}>
                                  <ExclamationTriangleIcon className="h-4 w-4" />
                                  <span className="text-[10px] hidden sm:inline">{r.warnings[0]}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {excelRows.length > 50 && (
                    <div className="p-2 text-center text-xs text-slate-400 border-t border-white/5">
                      {locale === 'kh' ? `បង្ហាញតែ 50 ក្នុងចំណោម ${excelRows.length} ជួរ` : `Showing 50 of ${excelRows.length} rows`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-slate-950/40">
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
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer font-khmer"
              >
                {t("cancel")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={excelRows.filter(r => r.isValid).length === 0 || excelImportLoading}
                  onClick={handleInsertAllLeaves}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg cursor-pointer font-khmer border-none"
                >
                  {excelImportLoading ? (
                    <span>{locale === 'kh' ? 'កំពុងបញ្ចូល...' : 'Importing...'}</span>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 stroke-[2.5]" />
                      <span>
                        {locale === 'kh'
                          ? `នាំចូលទិន្នន័យ (${excelRows.filter(r => r.isValid).length})`
                          : `Import Valid Records (${excelRows.filter(r => r.isValid).length})`}
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

export default Leaves;
