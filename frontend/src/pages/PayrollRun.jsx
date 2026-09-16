import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  BanknotesIcon,
  PlusIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const PayrollRun = () => {
  const { t, language, getLocalizedName } = useLanguage();
  const isKhmer = language === 'kh';

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [currentRun, setCurrentRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genMonth, setGenMonth] = useState(() => new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(() => new Date().getFullYear());
  const [genStandardDays, setGenStandardDays] = useState(26);
  const [genExchangeRate, setGenExchangeRate] = useState(4100);
  const [genNote, setGenNote] = useState('');

  // Adjustment Modal
  const [adjustingPayslip, setAdjustingPayslip] = useState(null);
  const [adjBonus, setAdjBonus] = useState(0);
  const [adjCommission, setAdjCommission] = useState(0);
  const [adjAdvance, setAdjAdvance] = useState(0);
  const [adjOtherDeductions, setAdjOtherDeductions] = useState(0);
  const [adjRemarks, setAdjRemarks] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  // Message banner
  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });

  const showBanner = (text, type = 'success') => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg({ type: '', text: '' }), 4000);
  };

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll/runs');
      const data = res.data || [];
      setRuns(data);
      if (data.length > 0) {
        const targetId = selectedRunId && data.some(r => r.id === selectedRunId)
          ? selectedRunId
          : data[0].id;
        setSelectedRunId(targetId);
        await fetchRunDetails(targetId);
      } else {
        setCurrentRun(null);
        setPayslips([]);
      }
    } catch (err) {
      console.error('Error fetching payroll runs:', err);
      showBanner(isKhmer ? 'បរាជ័យក្នុងការទាញយកទិន្នន័យ Payroll' : 'Failed to fetch payroll runs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetails = async (runId) => {
    if (!runId) return;
    try {
      const [runRes, slipsRes] = await Promise.all([
        api.get(`/payroll/runs/${runId}`),
        api.get(`/payroll/runs/${runId}/payslips`)
      ]);
      setCurrentRun(runRes.data);
      setPayslips(slipsRes.data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching run details:', err);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleSelectRun = (runId) => {
    setSelectedRunId(runId);
    fetchRunDetails(runId);
  };

  const handleGenerateRun = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await api.post('/payroll/runs/generate', {
        month: Number(genMonth),
        year: Number(genYear),
        standardWorkingDays: Number(genStandardDays),
        exchangeRateKhr: Number(genExchangeRate),
        note: genNote
      });
      showBanner(isKhmer ? 'បានគណនាប្រាក់ខែដោយជោគជ័យ!' : 'Payroll generated successfully!');
      setShowGenerateModal(false);
      setSelectedRunId(res.data.id);
      await fetchRuns();
      await fetchRunDetails(res.data.id);
    } catch (err) {
      console.error('Error generating payroll:', err);
      showBanner(err.response?.data?.message || (isKhmer ? 'បរាជ័យក្នុងការគណនាប្រាក់ខែ' : 'Failed to generate payroll'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!currentRun) return;
    if (!window.confirm(isKhmer ? 'តើអ្នកពិតជាចង់អនុម័ត (Approve) ប្រាក់ខែខែនេះមែនទេ? បន្ទាប់ពីអនុម័ត ទិន្នន័យនឹងត្រូវចាក់សោរ។' : 'Are you sure you want to approve this payroll run? Data will be locked.')) {
      return;
    }
    try {
      await api.put(`/payroll/runs/${currentRun.id}/approve`);
      showBanner(isKhmer ? 'បានអនុម័តប្រាក់ខែដោយជោគជ័យ!' : 'Payroll run approved successfully!');
      await fetchRunDetails(currentRun.id);
      await fetchRuns();
    } catch (err) {
      console.error('Error approving run:', err);
      showBanner(err.response?.data?.message || 'Error approving payroll', 'error');
    }
  };

  const handleMarkPaid = async () => {
    if (!currentRun) return;
    if (!window.confirm(isKhmer ? 'តើអ្នកពិតជាចង់សម្គាល់ថាបានបើកប្រាក់ខែរួច (Paid) មែនទេ?' : 'Mark this payroll run as paid?')) {
      return;
    }
    try {
      await api.put(`/payroll/runs/${currentRun.id}/mark-paid`);
      showBanner(isKhmer ? 'បានសម្គាល់ថាបើករួចដោយជោគជ័យ!' : 'Payroll marked as paid successfully!');
      await fetchRunDetails(currentRun.id);
      await fetchRuns();
    } catch (err) {
      console.error('Error marking paid:', err);
      showBanner(err.response?.data?.message || 'Error marking payroll paid', 'error');
    }
  };

  const handleExportBank = async () => {
    if (!currentRun) return;
    try {
      const response = await api.get(`/payroll/runs/${currentRun.id}/export/bank`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ABA_Bulk_Payment_${currentRun.month}_${currentRun.year}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showBanner(isKhmer ? 'បានទាញយកឯកសារ Bank Bulk Payment ដោយជោគជ័យ' : 'Bank file downloaded successfully');
    } catch (err) {
      console.error('Error downloading bank file:', err);
      showBanner('Failed to export bank file', 'error');
    }
  };

  const handleClearRun = async () => {
    if (!currentRun) return;
    const confirmMsg = isKhmer
      ? `តើអ្នកពិតជាចង់សម្អាត/លុប (Clear) វដ្តប្រាក់ខែ "${currentRun.title}" មែនទេ? រាល់ទិន្នន័យ Payslips នៃខែនេះនឹងត្រូវបានលុបចេញពីប្រព័ន្ធទាំងស្រុង។`
      : `Are you sure you want to clear/delete the payroll run "${currentRun.title}"? All payslip data will be permanently removed.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.delete(`/payroll/runs/${currentRun.id}`);
      showBanner(isKhmer ? 'បានសម្អាតវដ្តប្រាក់ខែដោយជោគជ័យ!' : 'Payroll run cleared successfully!');
      setSelectedRunId('');
      setCurrentRun(null);
      setPayslips([]);
      await fetchRuns();
    } catch (err) {
      console.error('Error clearing payroll run:', err);
      showBanner(err.response?.data?.message || 'Failed to clear payroll run', 'error');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDeptFilter('');
    setCurrentPage(1);
  };

  const handleClearGenerateForm = () => {
    setGenMonth(new Date().getMonth() + 1);
    setGenYear(new Date().getFullYear());
    setGenStandardDays(26);
    setGenExchangeRate(4100);
    setGenNote('');
  };

  const handleClearAdjustmentForm = () => {
    setAdjBonus(0);
    setAdjCommission(0);
    setAdjAdvance(0);
    setAdjOtherDeductions(0);
    setAdjRemarks('');
  };

  const openAdjustModal = (slip) => {
    setAdjustingPayslip(slip);
    setAdjBonus(slip.bonusAmount || 0);
    setAdjCommission(slip.commissionAmount || 0);
    setAdjAdvance(slip.advanceDeduction || 0);
    setAdjOtherDeductions(slip.otherDeductions || 0);
    setAdjRemarks(slip.remarks || '');
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustingPayslip) return;
    try {
      setSavingAdj(true);
      await api.put(`/payroll/payslips/${adjustingPayslip.id}/adjust`, {
        bonusAmount: Number(adjBonus),
        commissionAmount: Number(adjCommission),
        advanceDeduction: Number(adjAdvance),
        otherDeductions: Number(adjOtherDeductions),
        remarks: adjRemarks
      });
      showBanner(isKhmer ? 'បានកែសម្រួលប្រាក់ខែបុគ្គលិកដោយជោគជ័យ' : 'Payslip adjusted successfully');
      setAdjustingPayslip(null);
      await fetchRunDetails(currentRun.id);
    } catch (err) {
      console.error('Error adjusting payslip:', err);
      showBanner(err.response?.data?.message || 'Failed to adjust payslip', 'error');
    } finally {
      setSavingAdj(false);
    }
  };

  // Filtered payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter(p => {
      const matchSearch = searchTerm === '' ||
        (p.staffId && p.staffId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.employeeNameEn && p.employeeNameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.employeeNameKh && p.employeeNameKh.includes(searchTerm));
      const matchDept = deptFilter === '' || (p.departmentName && p.departmentName === deptFilter);
      return matchSearch && matchDept;
    });
  }, [payslips, searchTerm, deptFilter]);

  // Paginated records
  const totalRecords = filteredPayslips.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedPayslips = useMemo(() => {
    return filteredPayslips.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredPayslips, currentPage, pageSize]);

  const uniqueDepartments = Array.from(new Set(payslips.map(p => p.departmentName).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12 text-slate-100">
      {/* Alert Banner */}
      {bannerMsg.text && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-sm shadow-md ${
          bannerMsg.type === 'error'
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        }`}>
          <span>{bannerMsg.text}</span>
          <button onClick={() => setBannerMsg({ type: '', text: '' })} className="cursor-pointer">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header - Matching Reports / AttendanceIncomplete exactly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
            <BanknotesIcon className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {isKhmer ? 'ប្រព័ន្ធគណនា និងបើកប្រាក់ខែ (Payroll Management)' : 'Payroll Management'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {isKhmer
                ? 'គណនាប្រាក់ខែបុគ្គលិកដោយស្វ័យប្រវត្តិតាមវត្តមាន ម៉ោងថែម ប.ស.ស (NSSF) និងពន្ធលើប្រាក់បៀវត្សរ៍ (TOS)'
                : 'Automated salary calculation based on attendance, OT, NSSF and Cambodia Tax on Salary'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Bank Button */}
          {currentRun && (
            <button
              type="button"
              onClick={handleExportBank}
              className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer font-khmer"
              title="Export Bank CSV"
            >
              <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
              <span>{isKhmer ? 'Export Bank (ABA)' : 'Export Bank CSV'}</span>
            </button>
          )}

          {currentRun?.status === 'Draft' && (
            <button
              type="button"
              onClick={handleApprove}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer font-khmer"
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>{isKhmer ? 'អនុម័ត (Approve)' : 'Approve Run'}</span>
            </button>
          )}

          {currentRun?.status === 'Approved' && (
            <button
              type="button"
              onClick={handleMarkPaid}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer font-khmer"
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>{isKhmer ? 'សម្គាល់ថាបើករួច (Paid)' : 'Mark as Paid'}</span>
            </button>
          )}

          {/* Clear / Delete Run Button */}
          {currentRun && (
            <button
              type="button"
              onClick={handleClearRun}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer font-khmer"
              title={isKhmer ? 'សម្អាត / លុបវដ្តប្រាក់ខែនេះ' : 'Clear / Delete this payroll run'}
            >
              <TrashIcon className="h-4 w-4 text-rose-400" />
              <span>{isKhmer ? 'សម្អាតវដ្តនេះ (Clear)' : 'Clear Run'}</span>
            </button>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-500/25 cursor-pointer font-khmer border-none"
          >
            <PlusIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{isKhmer ? '+ គណនាប្រាក់ខែថ្មី' : '+ New Payroll Run'}</span>
          </button>
        </div>
      </div>

      {/* Cycle Selector Bar */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10 no-print shadow-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-400 uppercase font-khmer">
            {isKhmer ? 'វដ្តប្រាក់ខែ (Payroll Cycle):' : 'Select Cycle:'}
          </label>
          <select
            value={selectedRunId}
            onChange={(e) => handleSelectRun(e.target.value)}
            className="py-2 px-3 border border-white/10 bg-slate-950/60 text-indigo-300 rounded-xl text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer font-khmer"
          >
            {runs.length === 0 && (
              <option value="">{isKhmer ? 'មិនទាន់មានប្រវត្តិ Payroll' : 'No payroll runs yet'}</option>
            )}
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.status}) - {r.totalEmployees} {isKhmer ? 'នាក់' : 'staff'}
              </option>
            ))}
          </select>
        </div>

        {currentRun && (
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold font-mono border ${
              currentRun.status === 'Paid'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : currentRun.status === 'Approved'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              {currentRun.status}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (1 USD = {currentRun.exchangeRateKhr?.toLocaleString()} KHR)
            </span>
          </div>
        )}
      </div>

      {/* Summary KPI Cards - Matching style of AttendanceIncomplete & Reports */}
      {currentRun && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
          {/* Total Employees */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                  {isKhmer ? 'បុគ្គលិកសរុប' : 'Total Employees'}
                </p>
                <p className="text-2xl font-black text-white mt-1 font-mono">
                  {currentRun.totalEmployees}
                </p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <UserGroupIcon className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-khmer">
              {isKhmer ? 'ចំនួនបុគ្គលិកក្នុងវដ្តប្រាក់ខែនេះ' : 'Employees in this payroll cycle'}
            </p>
          </div>

          {/* Total Gross */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                  {isKhmer ? 'ប្រាក់បៀវត្សសរុប (Gross)' : 'Total Gross'}
                </p>
                <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                  ${Number(currentRun.totalGross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <CurrencyDollarIcon className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-khmer">
              {isKhmer ? 'ប្រាក់ខែគោល + ប្រាក់បន្ថែម + ម៉ោងថែម' : 'Base + Allowances + OT'}
            </p>
          </div>

          {/* Total Deductions */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                  {isKhmer ? 'កាត់សរុប (Deductions)' : 'Total Deductions'}
                </p>
                <p className="text-2xl font-black text-rose-400 mt-1 font-mono">
                  ${Number(currentRun.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                <BanknotesIcon className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-khmer">
              {isKhmer ? 'NSSF + ពន្ធ + មកយឺត + ឈប់ឥតច្បាប់' : 'NSSF, Tax, Late & Unpaid Leave'}
            </p>
          </div>

          {/* Total Net Pay */}
          <div className="glass-card p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase font-khmer font-bold">
                  {isKhmer ? 'ប្រាក់ខែសុទ្ធសរុប (Net Pay)' : 'Total Net Pay'}
                </p>
                <p className="text-2xl font-black text-emerald-300 mt-1 font-mono">
                  ${Number(currentRun.totalNet || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-2 font-khmer font-mono">
              ~{(Number(currentRun.totalNet || 0) * (currentRun.exchangeRateKhr || 4100)).toLocaleString()} KHR
            </p>
          </div>

          {/* NSSF & Tax Breakdown */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase font-khmer">
                {isKhmer ? 'ប.ស.ស & ពន្ធបៀវត្ស' : 'NSSF & Tax Breakdown'}
              </p>
              <div className="mt-2 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[11px] font-khmer text-slate-400">NSSF និយោជិត:</span>
                  <span className="font-bold text-indigo-400">${Number(currentRun.totalNssfEmployee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[11px] font-khmer text-slate-400">NSSF និយោជក:</span>
                  <span className="font-bold text-purple-400">${Number(currentRun.totalNssfEmployer || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-[11px] font-khmer text-slate-400">ពន្ធ TOS:</span>
                  <span className="font-bold text-amber-400">${Number(currentRun.totalTax || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter & Search Strip */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={isKhmer ? 'ស្វែងរក ឈ្មោះ ឬ អត្តលេខ...' : 'Search staff ID or name...'}
              className="w-full py-2 pl-9 pr-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="py-2 px-3 border border-white/10 bg-slate-950/60 text-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer cursor-pointer"
          >
            <option value="">{isKhmer ? 'គ្រប់នាយកដ្ឋាន' : 'All Departments'}</option>
            {uniqueDepartments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Clear Filter Button */}
          {(searchTerm || deptFilter) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer font-khmer shadow-sm"
              title={isKhmer ? 'សម្អាតការស្វែងរក' : 'Clear filters'}
            >
              <XMarkIcon className="w-4 h-4" />
              <span>{isKhmer ? 'សម្អាត Filter' : 'Clear Filter'}</span>
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-khmer">
          {isKhmer ? 'បង្ហាញបុគ្គលិក:' : 'Showing:'} <span className="font-bold text-white font-mono">{filteredPayslips.length}</span> {isKhmer ? 'នាក់' : 'records'}
        </div>
      </div>

      {/* Main Payslip Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-300 font-khmer text-xs uppercase tracking-wider">
                <th className="p-3.5">Staff ID / Name</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5 text-center">Contract</th>
                <th className="p-3.5 text-right">Base Salary</th>
                <th className="p-3.5 text-center">Days / OT</th>
                <th className="p-3.5 text-right">Allowances</th>
                <th className="p-3.5 text-right font-bold text-amber-400">Gross</th>
                <th className="p-3.5 text-right">NSSF (2%)</th>
                <th className="p-3.5 text-right">TOS Tax</th>
                <th className="p-3.5 text-right">Deductions</th>
                <th className="p-3.5 text-right font-bold text-emerald-400">Net Salary ($)</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="12" className="p-8 text-center text-slate-400 font-khmer">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    {isKhmer ? 'កំពុងទាញយកទិន្នន័យ...' : 'Loading payroll data...'}
                  </td>
                </tr>
              ) : paginatedPayslips.length === 0 ? (
                <tr>
                  <td colSpan="12" className="p-8 text-center text-slate-400 font-khmer">
                    {isKhmer ? 'មិនមានទិន្នន័យប្រាក់ខែឡើយ' : 'No payslip records found'}
                  </td>
                </tr>
              ) : (
                paginatedPayslips.map((p) => {
                  const allowancesSum = Number(p.transportAllowance || 0) +
                    Number(p.mealAllowance || 0) +
                    Number(p.housingAllowance || 0) +
                    Number(p.phoneAllowance || 0) +
                    Number(p.attendanceAllowance || 0) +
                    Number(p.otherAllowances || 0);

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.03] transition-colors border-b border-white/5">
                      <td className="p-3.5">
                        <div className="font-bold text-white font-mono">{p.staffId}</div>
                        <div className="text-[11px] text-slate-300 font-khmer">{p.employeeNameEn || p.employeeNameKh}</div>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div>{p.departmentName || '-'}</div>
                        <div className="text-[10px] text-slate-500">{p.positionTitle || '-'}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                          p.contractType === 'UDC'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {p.contractType || 'UDC'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-200">
                        ${Number(p.baseSalary || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center text-[11px] text-slate-400 font-mono">
                        <div>{p.workedDays}/{p.standardWorkingDays}d</div>
                        {(Number(p.normalOtHours) > 0 || Number(p.holidayOtHours) > 0) && (
                          <div className="text-amber-400 text-[10px]">
                            +{(Number(p.normalOtHours) + Number(p.holidayOtHours)).toFixed(1)}h OT
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        ${allowancesSum.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-amber-300">
                        ${Number(p.grossSalary || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-indigo-300">
                        ${Number(p.nssfEmployeeAmount || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        ${Number(p.taxOnSalaryAmount || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-rose-400">
                        -${Number(p.totalDeductions || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        ${Number(p.netSalary || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {currentRun?.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => openAdjustModal(p)}
                              className="p-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                              title={isKhmer ? 'កែសម្រួល Bonus / កាត់ប្រាក់' : 'Adjust Payslip'}
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            to={`/payroll/payslips?runId=${currentRun?.id}&staffId=${p.staffId}`}
                            className="p-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition-colors"
                            title={isKhmer ? 'មើល Payslip' : 'View Payslip'}
                          >
                            <DocumentTextIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar - Matching Reports.jsx */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div>
              {isKhmer ? 'ទំព័រទី' : 'Page'} <span className="font-bold text-white font-mono">{currentPage}</span> / {totalPages}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GENERATE RUN MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-card bg-slate-900/95 border border-white/15 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <BanknotesIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-khmer">
                    {isKhmer ? 'គណនាប្រាក់ខែប្រចាំខែ (New Payroll Run)' : 'New Payroll Run'}
                  </h3>
                  <p className="text-xs text-slate-400 font-khmer mt-0.5">
                    {isKhmer ? 'ប្រព័ន្ធនឹងទាញទិន្នន័យវត្តមាន ម៉ោងថែម និងច្បាប់មកគណនាដោយស្វ័យប្រវត្តិ' : 'Automated calculation engine'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateRun} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'សម្រាប់ខែ (Month)' : 'Month'}
                  </label>
                  <select
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>Month {m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'សម្រាប់ឆ្នាំ (Year)' : 'Year'}
                  </label>
                  <input
                    type="number"
                    value={genYear}
                    onChange={(e) => setGenYear(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'ថ្ងៃធ្វើការស្ដង់ដារ (Days)' : 'Standard Working Days'}
                  </label>
                  <input
                    type="number"
                    value={genStandardDays}
                    onChange={(e) => setGenStandardDays(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'អត្រាប្តូរប្រាក់ (KHR/USD)' : 'Exchange Rate'}
                  </label>
                  <input
                    type="number"
                    value={genExchangeRate}
                    onChange={(e) => setGenExchangeRate(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                  {isKhmer ? 'កំណត់សម្គាល់ (Note)' : 'Note / Remark'}
                </label>
                <textarea
                  value={genNote}
                  onChange={(e) => setGenNote(e.target.value)}
                  rows="2"
                  placeholder={isKhmer ? 'ឧ. បើកប្រាក់ខែប្រចាំខែ...' : 'Optional notes...'}
                  className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClearGenerateForm}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer font-khmer"
                >
                  {isKhmer ? 'សម្អាតទម្រង់ (Clear)' : 'Clear Form'}
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer font-khmer"
                  >
                    {isKhmer ? 'បោះបង់' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 font-khmer border-none"
                  >
                    {generating ? (isKhmer ? 'កំពុងគណនា...' : 'Calculating...') : (isKhmer ? 'ចាប់ផ្តើមគណនា' : 'Calculate Payroll')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST PAYSLIP MODAL */}
      {adjustingPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-card bg-slate-900/95 border border-white/15 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <PencilSquareIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-khmer">
                    {isKhmer ? 'កែសម្រួលប្រាក់ខែបុគ្គលិក' : 'Adjust Payslip'}
                  </h3>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">
                    {adjustingPayslip.staffId} - {adjustingPayslip.employeeNameEn || adjustingPayslip.employeeNameKh}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingPayslip(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'ប្រាក់រង្វាន់លើកទឹកចិត្ត (Bonus $)' : 'Bonus ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjBonus}
                    onChange={(e) => setAdjBonus(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'កម្រៃជើងសារ (Commission $)' : 'Commission ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjCommission}
                    onChange={(e) => setAdjCommission(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'កាត់ប្រាក់បុរេប្រទាន (Advance $)' : 'Advance Deduction ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjAdvance}
                    onChange={(e) => setAdjAdvance(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                    {isKhmer ? 'ការកាត់ផ្សេងៗ (Other Ded. $)' : 'Other Deductions ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjOtherDeductions}
                    onChange={(e) => setAdjOtherDeductions(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                  {isKhmer ? 'មូលហេតុកែសម្រួល (Remarks)' : 'Remarks / Reason'}
                </label>
                <textarea
                  value={adjRemarks}
                  onChange={(e) => setAdjRemarks(e.target.value)}
                  rows="2"
                  placeholder={isKhmer ? 'បញ្ជាក់មូលហេតុ...' : 'Adjustment remarks...'}
                  className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClearAdjustmentForm}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer font-khmer"
                >
                  {isKhmer ? 'សម្អាត (Clear)' : 'Clear'}
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAdjustingPayslip(null)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer font-khmer"
                  >
                    {isKhmer ? 'បោះបង់' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdj}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 font-khmer border-none"
                  >
                    {savingAdj ? (isKhmer ? 'កំពុងរក្សាទុក...' : 'Saving...') : (isKhmer ? 'រក្សាទុក & គណនាឡើងវិញ' : 'Save & Recalculate')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollRun;
