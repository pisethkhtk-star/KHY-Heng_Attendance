import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, CheckIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const Leaves = () => {
  const { user } = useAuth();
  const { t, getLocalizedName, locale } = useLanguage();
  const canApprove = ['Admin', 'HR', 'Manager'].includes(user.role);

  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);

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
                  {canApprove && <th className="py-4 px-6 text-right font-khmer whitespace-nowrap min-w-[110px]">{t("actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={9 + (user.role !== 'Employee' ? 1 : 0) + (canApprove ? 1 : 0)} className="py-6 text-center text-slate-500 font-khmer">
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
                        {canApprove && (
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            {leave.status === 'Pending' ? (
                              <div className="inline-flex items-center justify-end gap-2">
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
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic font-khmer">-</span>
                            )}
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
    </div>
  );
};

export default Leaves;
