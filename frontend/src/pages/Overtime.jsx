import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  UserCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const Overtime = () => {
  const { user, hasPermission } = useAuth();
  const { t, getLocalizedName, locale } = useLanguage();
  const canApprove = ['Admin', 'HR', 'Manager'].includes(user?.role) || hasPermission('overtime');

  // State
  const [overtimes, setOvertimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [decisionType, setDecisionType] = useState('Approved'); // 'Approved' or 'Rejected'
  const [decisionComment, setDecisionComment] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Form State for Request
  const [selectedStaffId, setSelectedStaffId] = useState(user?.staffId || '');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [startTime, setStartTime] = useState('17:30');
  const [endTime, setEndTime] = useState('20:30');
  const [amountDay, setAmountDay] = useState('0.38');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getEmployeePhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  // Fetch branches & employees
  const fetchMetadata = async () => {
    try {
      const [branchRes, empRes] = await Promise.all([
        api.get('/kiosk-settings').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] }))
      ]);
      setBranches(branchRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  // Fetch Overtime list
  const fetchOvertimes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterBranch) params.append('branch', filterBranch);
      if (startDateFilter) params.append('startDate', startDateFilter);
      if (endDateFilter) params.append('endDate', endDateFilter);
      if (search) params.append('search', search);

      const response = await api.get(`/overtimes?${params.toString()}`);
      setOvertimes(response.data || []);
    } catch (error) {
      console.error('Error fetching overtimes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchOvertimes();
  }, [filterStatus, filterBranch, startDateFilter, endDateFilter, search]);

  // Auto calculate amountDay based on start/end date and start/end time
  useEffect(() => {
    if (!fromDate || !toDate || !startTime || !endTime) return;
    try {
      const startD = new Date(fromDate);
      const endD = new Date(toDate);
      if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || startD > endD) return;

      const dayDiff = Math.max(1, Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1);

      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      let hours = (eH + (eM || 0) / 60) - (sH + (sM || 0) / 60);
      if (hours < 0) hours += 24;

      const calculatedFraction = parseFloat((hours / 8).toFixed(2));
      const totalAmount = parseFloat((dayDiff * (calculatedFraction > 0 ? calculatedFraction : 1.0)).toFixed(2));
      setAmountDay(totalAmount.toString());
    } catch (e) {
      console.error('Calculation error:', e);
    }
  }, [fromDate, toDate, startTime, endTime]);

  // Open Request Modal
  const handleOpenRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedStaffId(user?.staffId || '');
    setFromDate(today);
    setToDate(today);
    setStartTime('17:30');
    setEndTime('20:30');
    setAmountDay('0.38');
    setReason('');
    setFormError('');

    // Pre-populate branch if available
    if (user?.branch) {
      const matched = branches.find(b => b.name?.toLowerCase() === user.branch?.toLowerCase());
      if (matched) {
        setSelectedBranchId(matched.id);
        setSelectedBranchName(matched.name);
      } else {
        setSelectedBranchName(user.branch);
        setSelectedBranchId(branches[0]?.id || '');
      }
    } else if (branches.length > 0) {
      setSelectedBranchId(branches[0].id);
      setSelectedBranchName(branches[0].name);
    }

    setShowRequestModal(true);
  };

  // Handle Submit Overtime Request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !startTime || !endTime) {
      setFormError(t('fillRequiredDatesError'));
      return;
    }
    if (!reason.trim()) {
      setFormError(t('reasonRequiredError'));
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      const creator = getLocalizedName(user?.nameEn, user?.nameKh) || user?.nameEn || user?.staffId || '';

      await api.post('/overtimes', {
        staffId: selectedStaffId || user?.staffId,
        fromDate,
        toDate,
        startTime,
        endTime,
        amountDay: parseFloat(amountDay) || 0,
        reason: reason.trim(),
        branchId: selectedBranchId || undefined,
        branch: selectedBranchName || undefined,
        createdBy: creator,
      });

      setShowRequestModal(false);
      fetchOvertimes();
    } catch (error) {
      console.error('Error submitting overtime:', error);
      setFormError(error.response?.data?.message || 'Failed to submit overtime request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Decision (Approve/Reject) Modal
  const handleOpenDecision = (item, type) => {
    setSelectedOvertime(item);
    setDecisionType(type);
    setDecisionComment(item.comment || '');
    setShowDecisionModal(true);
  };

  // Submit Decision
  const handleSubmitDecision = async () => {
    if (!selectedOvertime) return;
    try {
      setIsSubmittingDecision(true);
      await api.put(`/overtimes/${selectedOvertime.id}/status`, {
        status: decisionType,
        comment: decisionComment.trim(),
        managerName: getLocalizedName(user?.nameEn, user?.nameKh) || user?.staffId,
      });
      setShowDecisionModal(false);
      fetchOvertimes();
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error.response?.data?.message || 'Failed to update overtime status');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Delete Overtime
  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/overtimes/${id}`);
      fetchOvertimes();
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.response?.data?.message || 'Failed to delete overtime request');
    }
  };

  // Statistics Summary
  const stats = useMemo(() => {
    const total = overtimes.length;
    const pending = overtimes.filter(o => o.status === 'Pending').length;
    const approved = overtimes.filter(o => o.status === 'Approved').length;
    const rejected = overtimes.filter(o => o.status === 'Rejected').length;
    const totalDays = overtimes
      .filter(o => o.status === 'Approved')
      .reduce((sum, o) => sum + (parseFloat(o.amountDay) || 0), 0);

    return { total, pending, approved, rejected, totalDays: totalDays.toFixed(2) };
  }, [overtimes]);

  // Helper date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0].substring(0, 5)}`;
    } catch {
      return dateStr;
    }
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

  const handleExportExcel = () => {
    if (overtimes.length === 0) {
      alert(locale === 'kh' ? 'មិនមានទិន្នន័យថែមម៉ោងសម្រាប់ Export ឡើយ!' : 'No overtime records to export!');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const title = `Overtime Requests Report (${todayStr})`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Overtime</x:Name>
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
            <td colspan="16" class="title-row" style="font-size:14pt; font-weight:bold; text-align:center; height:35px;">
              ${title}
            </td>
          </tr>
          <tr>
            <td colspan="16" style="text-align:center; font-size:9pt; color:#64748b; height:20px;">
              Exported: ${new Date().toLocaleString()} | Filter Status: ${filterStatus || 'All'} | Total Records: ${overtimes.length}
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
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:130px;">Branch</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px; text-align:center;">From Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px; text-align:center;">To Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:80px; text-align:center;">Start Time</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:80px; text-align:center;">End Time</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:80px; text-align:center;">Days</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:220px;">Reason</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:100px; text-align:center;">Status</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:140px;">Manager</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Manager Comment</th>
            </tr>
          </thead>
          <tbody>
    `;

    overtimes.forEach((item, idx) => {
      const emp = employees.find(e => e.staffId === item.staffId) || item.employee || {};
      const deptName = emp.department ? (emp.department.nameEn || '') : '';
      const posTitle = emp.position ? (emp.position.titleEn || '') : '';
      const branchDisplay = item.branchLocation?.name || item.branch || emp?.branch || '-';
      const managerDisplay = item.manager
        ? (item.manager.nameEn || item.manager.nameKh || '')
        : (item.managerName || '-');

      let statusBg = '#fef3c7';
      let statusColor = '#b45309';
      if (item.status === 'Approved') {
        statusBg = '#d1fae5';
        statusColor = '#047857';
      } else if (item.status === 'Rejected') {
        statusBg = '#ffe4e6';
        statusColor = '#be123c';
      }

      excelHTML += `
        <tr>
          <td style="border:1px solid #000000; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000000; font-weight:bold;">${item.staffId || emp.staffId || '-'}</td>
          <td style="border:1px solid #000000;">${emp.nameEn || ''}</td>
          <td style="border:1px solid #000000;">${emp.nameKh || ''}</td>
          <td style="border:1px solid #000000;">${deptName}</td>
          <td style="border:1px solid #000000;">${posTitle}</td>
          <td style="border:1px solid #000000;">${branchDisplay}</td>
          <td style="border:1px solid #000000; text-align:center;">${formatDate(item.fromDate)}</td>
          <td style="border:1px solid #000000; text-align:center;">${formatDate(item.toDate)}</td>
          <td style="border:1px solid #000000; text-align:center;">${item.startTime || '-'}</td>
          <td style="border:1px solid #000000; text-align:center;">${item.endTime || '-'}</td>
          <td style="border:1px solid #000000; text-align:center; font-weight:bold;">${item.amountDay || '1'}</td>
          <td style="border:1px solid #000000;">${item.reason || '-'}</td>
          <td style="border:1px solid #000000; text-align:center; font-weight:bold; background-color:${statusBg}; color:${statusColor};">${item.status || 'Pending'}</td>
          <td style="border:1px solid #000000;">${managerDisplay}</td>
          <td style="border:1px solid #000000;">${item.comment || '-'}</td>
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
    link.setAttribute('download', `Overtime_Requests${filterTag}_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer flex items-center gap-2.5">
            <ClockIcon className="h-6 w-6 text-indigo-400" />
            <span>{t('overtime')}</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-khmer">
            {t('overtimeSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={overtimes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
            title="Export overtime requests to Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            onClick={handleOpenRequestModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none flex-1 sm:flex-initial justify-center"
          >
            <PlusIcon className="h-5 w-5" />
            <span>{t('requestOvertime')}</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium font-khmer">{t('totalRequests')}</p>
            <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <CalendarDaysIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400 font-medium font-khmer">{t('pendingRequests')}</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <ClockIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-400 font-medium font-khmer">{t('approvedRequests')}</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.approved}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircleIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-400 font-medium font-khmer">{t('rejectedRequests')}</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{stats.rejected}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <XCircleIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-xs text-indigo-300 font-medium font-khmer">{t('totalApprovedDays')}</p>
            <p className="text-2xl font-black text-indigo-300 mt-1">
              {stats.totalDays} <span className="text-xs font-normal font-khmer">{t('daysUnit')}</span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ClockIcon className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t('search')}</label>
            <input
              type="text"
              placeholder={t('searchPlaceholderOvertime')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t('status')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{t('allStatus')}</option>
              <option value="Pending" className="bg-slate-900">{t('pending')}</option>
              <option value="Approved" className="bg-slate-900">{t('approved')}</option>
              <option value="Rejected" className="bg-slate-900">{t('rejected')}</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t('branch')}</label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{t('allBranches')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.name} className="bg-slate-900">{b.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t('fromDate')}</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 font-khmer">{t('toDate')}</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
              />
              {(filterStatus || filterBranch || startDateFilter || endDateFilter || search) && (
                <button
                  onClick={() => {
                    setFilterStatus('');
                    setFilterBranch('');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setSearch('');
                  }}
                  className="px-2.5 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl transition cursor-pointer"
                  title={t('clear')}
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
              <tr>
                <th className="py-4 px-6 font-khmer whitespace-nowrap w-16 text-center">{t("noNumber")}</th>
                <th className="py-4 px-6 font-khmer">{t('employee')}</th>
                <th className="py-4 px-6 font-khmer">{t('manager')}</th>
                <th className="py-4 px-6 font-khmer">{t('branch')}</th>
                <th className="py-4 px-6 font-khmer">{t('fromDate')}</th>
                <th className="py-4 px-6 font-khmer">{t('toDate')}</th>
                <th className="py-4 px-6 font-khmer">{t('startTime')}</th>
                <th className="py-4 px-6 font-khmer">{t('endTime')}</th>
                <th className="py-4 px-6 text-center font-khmer">{t('amountDay')}</th>
                <th className="py-4 px-6 min-w-[140px] font-khmer">{t('reason')}</th>
                <th className="py-4 px-6 font-khmer">{t('status')}</th>
                <th className="py-4 px-6 min-w-[130px] font-khmer">{t('comment')}</th>
                <th className="py-4 px-6 whitespace-nowrap font-khmer">{t('requestedAt')}</th>
                <th className="py-4 px-6 whitespace-nowrap font-khmer">{t('approvedAt')}</th>
                <th className="py-4 px-6 font-khmer">{t('createdBy')}</th>
                <th className="py-4 px-6 text-right font-khmer">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="16" className="py-12 text-center text-slate-400 font-khmer">
                    <div className="inline-flex items-center gap-2">
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-400" />
                      <span>{t('loading')}</span>
                    </div>
                  </td>
                </tr>
              ) : overtimes.length === 0 ? (
                <tr>
                  <td colSpan="16" className="py-12 text-center text-slate-500 font-khmer">
                    {t('noOvertimeData')}
                  </td>
                </tr>
              ) : (
                overtimes.map((item, index) => {
                  const emp = employees.find(e => e.staffId === item.staffId) || item.employee;
                  const photo = getEmployeePhoto(emp);
                  const nameEn = emp?.nameEn || item.staffId;
                  const nameKh = emp?.nameKh || '';
                  const deptName = emp?.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '';
                  const posTitle = emp?.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '';

                  const branchDisplay = item.branchLocation?.name || item.branch || emp?.branch || '-';
                  const managerDisplay = item.manager
                    ? getLocalizedName(item.manager.nameEn, item.manager.nameKh)
                    : (item.managerName || '-');

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      {/* 0. No. */}
                      <td className="py-4 px-6 text-center font-semibold text-slate-400 whitespace-nowrap font-mono">
                        {index + 1}
                      </td>

                      {/* 1. Employee */}
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
                              {nameEn?.charAt(0)?.toUpperCase() || item.staffId?.charAt(0) || '?'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">
                              {getLocalizedName(nameEn, nameKh)}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">
                              ID: <span className="text-indigo-400 font-semibold">{item.staffId}</span>{emp?.role ? ` • ${emp.role}` : ''}
                            </p>
                            {(deptName || posTitle) && (
                              <p className="text-xs font-semibold text-indigo-400">
                                {[deptName, posTitle].filter(Boolean).join(' • ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Manager */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <UserCircleIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                          <span className="font-medium font-khmer">{managerDisplay}</span>
                        </div>
                      </td>

                      {/* 3. Branch */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1 text-slate-400">
                          <BuildingOfficeIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                          <span className="font-khmer">{branchDisplay}</span>
                        </div>
                      </td>

                      {/* 4. fromDate */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs font-mono text-white">
                        {formatDate(item.fromDate)}
                      </td>

                      {/* 5. toDate */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs font-mono text-white">
                        {formatDate(item.toDate)}
                      </td>

                      {/* 6. starttime */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs font-mono text-emerald-400 font-semibold">
                        {item.startTime || '-'}
                      </td>

                      {/* 7. endtime */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs font-mono text-indigo-400 font-semibold">
                        {item.endTime || '-'}
                      </td>

                      {/* 8. Amount_day */}
                      <td className="py-4 px-6 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-950/60 border border-white/10 text-indigo-300 font-mono">
                          {item.amountDay} {parseFloat(item.amountDay) > 1 ? t('daysUnit') : t('dayUnit')}
                        </span>
                      </td>

                      {/* 9. Reason */}
                      <td className="py-4 px-6 text-xs max-w-[200px] truncate text-slate-300 font-khmer" title={item.reason || ''}>
                        {item.reason || '-'}
                      </td>

                      {/* 10. Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium font-khmer ring-1 ${
                          item.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                            : item.status === 'Rejected'
                              ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            item.status === 'Approved' ? 'bg-emerald-400' : item.status === 'Rejected' ? 'bg-rose-400' : 'bg-amber-400'
                          }`} />
                          {item.status === 'Approved' ? t('approved') : item.status === 'Rejected' ? t('rejected') : t('pending')}
                        </span>
                      </td>

                      {/* 11. Comment */}
                      <td className="py-4 px-6 text-xs text-slate-300 font-khmer max-w-[160px] truncate" title={item.comment || ''}>
                        {item.comment ? (
                          <div className="flex items-center gap-1">
                            <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                            <span>{item.comment}</span>
                          </div>
                        ) : '-'}
                      </td>

                      {/* 12. RequestedAt */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {formatDateTime(item.requestedAt)}
                      </td>

                      {/* 13. Approved At */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {formatDateTime(item.approvedAt)}
                      </td>

                      {/* 14. Created by */}
                      <td className="py-4 px-6 whitespace-nowrap text-xs text-slate-300 font-khmer">
                        {getCreatorDisplayName(item.createdBy || item.staffId)}
                      </td>

                      {/* 15. Actions */}
                      <td className="py-4 px-6 whitespace-nowrap text-right space-x-2">
                        <div className="inline-flex items-center gap-1.5">
                          {canApprove && item.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleOpenDecision(item, 'Approved')}
                                className="inline-flex p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 rounded-xl transition-colors border border-emerald-500/20 cursor-pointer"
                                title={t('approve')}
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDecision(item, 'Rejected')}
                                className="inline-flex p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 rounded-xl transition-colors border border-rose-500/20 cursor-pointer"
                                title={t('reject')}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {(canApprove || (user?.staffId === item.staffId && item.status === 'Pending')) && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex p-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 rounded-xl transition-colors cursor-pointer"
                              title={t('delete')}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Request Overtime Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 py-10">
          <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white font-khmer flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-indigo-400" />
                <span>{t('requestOvertime')}</span>
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1 cursor-pointer bg-transparent border-none"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl font-khmer text-center">
                  {formError}
                </div>
              )}

              {/* Employee selector for Admin/HR/Manager */}
              {['Admin', 'HR', 'Manager'].includes(user?.role) && employees.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t('employee')} <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      const emp = employees.find(x => x.staffId === e.target.value);
                      if (emp?.branch) {
                        setSelectedBranchName(emp.branch);
                        const bMatch = branches.find(b => b.name?.toLowerCase() === emp.branch?.toLowerCase());
                        if (bMatch) setSelectedBranchId(bMatch.id);
                      }
                    }}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                    required
                  >
                    {employees.map(e => (
                      <option key={e.staffId} value={e.staffId} className="bg-slate-900">
                        {e.staffId} - {getLocalizedName(e.nameEn, e.nameKh)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t('employee')}</label>
                  <input
                    type="text"
                    disabled
                    value={`${user?.staffId} - ${getLocalizedName(user?.nameEn, user?.nameKh)}`}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/40 text-slate-400 rounded-xl text-sm outline-none font-khmer"
                  />
                </div>
              )}

              {/* Branch */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t('branch')}</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    const b = branches.find(x => x.id === e.target.value);
                    if (b) setSelectedBranchName(b.name);
                  }}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  <option value="" className="bg-slate-900">{t('selectBranch')}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Range: From Date & To Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t('fromDate')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      if (toDate < e.target.value) setToDate(e.target.value);
                    }}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t('toDate')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Time: Start Time & End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t('startTime')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t('endTime')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>

              {/* Amount_day Calculation */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t('amountDay')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountDay}
                  onChange={(e) => setAmountDay(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-khmer">
                  {t('overtimeAutoCalculateHint')}
                </p>
              </div>

              {/* Reason / Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t('reason')} <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder={t('reason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer bg-transparent"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2 px-4 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
                >
                  {isSubmitting ? t('loading') : t('submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Review Decision (Approve/Reject) Modal */}
      {showDecisionModal && selectedOvertime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 py-10">
          <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white font-khmer flex items-center gap-2">
                {decisionType === 'Approved' ? (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-rose-400" />
                )}
                <span>{decisionType === 'Approved' ? t('approveOvertimeTitle') : t('rejectOvertimeTitle')}</span>
              </h3>
              <button
                onClick={() => setShowDecisionModal(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1 cursor-pointer bg-transparent border-none"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950/60 rounded-xl p-3.5 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-khmer">{t('employee')}៖</span>
                  <span className="font-semibold text-white font-khmer">
                    {getLocalizedName(selectedOvertime.employee?.nameEn, selectedOvertime.employee?.nameKh)} ({selectedOvertime.staffId})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-khmer">{t('fromDate')} - {t('toDate')}៖</span>
                  <span className="font-mono text-white">
                    {formatDate(selectedOvertime.fromDate)} {selectedOvertime.fromDate !== selectedOvertime.toDate ? `→ ${formatDate(selectedOvertime.toDate)}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-khmer">{t('amountDay')}៖</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {selectedOvertime.startTime} - {selectedOvertime.endTime} ({selectedOvertime.amountDay} {t('daysUnit')})
                  </span>
                </div>
                {selectedOvertime.reason && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-slate-400 font-khmer">{t('reason')}៖</p>
                    <p className="font-medium text-slate-200 font-khmer mt-0.5">{selectedOvertime.reason}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t('managerCommentLabel')}
                </label>
                <textarea
                  rows="3"
                  placeholder={t('managerCommentPlaceholder')}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer bg-transparent"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitDecision}
                  disabled={isSubmittingDecision}
                  className={`py-2 px-4 text-xs font-semibold rounded-xl shadow-md transition-all font-khmer cursor-pointer border-none outline-none disabled:opacity-50 text-white ${
                    decisionType === 'Approved'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-rose-500/25'
                  }`}
                >
                  {isSubmittingDecision
                    ? t('loading')
                    : decisionType === 'Approved'
                      ? t('approve')
                      : t('reject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overtime;
