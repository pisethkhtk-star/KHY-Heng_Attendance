import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  UserGroupIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const PayrollSalaryStructure = () => {
  const { locale, language } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit Modal State
  const [editingProfile, setEditingProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editBaseSalary, setEditBaseSalary] = useState(350);
  const [editSalaryCurrency, setEditSalaryCurrency] = useState('USD');
  const [editContractType, setEditContractType] = useState('UDC');
  const [editBankName, setEditBankName] = useState('ABA Bank');
  const [editBankAccountNumber, setEditBankAccountNumber] = useState('');
  const [editBankAccountName, setEditBankAccountName] = useState('');
  const [editMaritalStatus, setEditMaritalStatus] = useState('Single');
  const [editSpouseEligible, setEditSpouseEligible] = useState(false);
  const [editChildrenCount, setEditChildrenCount] = useState(0);
  const [editHasNssf, setEditHasNssf] = useState(true);
  const [editTransport, setEditTransport] = useState(0);
  const [editMeal, setEditMeal] = useState(0);
  const [editHousing, setEditHousing] = useState(0);
  const [editPhone, setEditPhone] = useState(0);
  const [editAttendance, setEditAttendance] = useState(0);
  const [editOther, setEditOther] = useState(0);
  const [editNote, setEditNote] = useState('');

  // Banner
  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });
  const showBanner = (text, type = 'success') => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg({ type: '', text: '' }), 4000);
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll/salary-profiles');
      setProfiles(res.data || []);
    } catch (err) {
      console.error('Error fetching salary profiles:', err);
      showBanner(isKhmer ? 'បរាជ័យក្នុងការទាញយកព័ត៌មានប្រាក់ខែបុគ្គលិក' : 'Failed to load salary profiles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openEditModal = (p) => {
    setEditingProfile(p);
    setEditBaseSalary(p.baseSalary || 350);
    setEditSalaryCurrency(p.salaryCurrency || 'USD');
    setEditContractType(p.contractType || 'UDC');
    setEditBankName(p.bankName || 'ABA Bank');
    setEditBankAccountNumber(p.bankAccountNumber || '');
    setEditBankAccountName(p.bankAccountName || p.nameEn || '');
    setEditMaritalStatus(p.maritalStatus || 'Single');
    setEditSpouseEligible(!!p.spouseAllowanceEligible);
    setEditChildrenCount(p.dependentChildrenCount || 0);
    setEditHasNssf(p.hasNssf !== false);
    setEditTransport(p.transportAllowance || 0);
    setEditMeal(p.mealAllowance || 0);
    setEditHousing(p.housingAllowance || 0);
    setEditPhone(p.phoneAllowance || 0);
    setEditAttendance(p.attendanceAllowance || 0);
    setEditOther(p.otherAllowances || 0);
    setEditNote(p.note || '');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editingProfile) return;
    try {
      setSaving(true);
      await api.put(`/payroll/salary-profiles/${editingProfile.staffId}`, {
        baseSalary: Number(editBaseSalary),
        salaryCurrency: editSalaryCurrency,
        contractType: editContractType,
        bankName: editBankName,
        bankAccountNumber: editBankAccountNumber,
        bankAccountName: editBankAccountName,
        maritalStatus: editMaritalStatus,
        spouseAllowanceEligible: editSpouseEligible,
        dependentChildrenCount: Number(editChildrenCount),
        hasNssf: editHasNssf,
        transportAllowance: Number(editTransport),
        mealAllowance: Number(editMeal),
        housingAllowance: Number(editHousing),
        phoneAllowance: Number(editPhone),
        attendanceAllowance: Number(editAttendance),
        otherAllowances: Number(editOther),
        note: editNote
      });
      showBanner(isKhmer ? 'បានកែប្រែព័ត៌មានប្រាក់ខែដោយជោគជ័យ' : 'Salary profile updated successfully');
      setEditingProfile(null);
      await fetchProfiles();
    } catch (err) {
      console.error('Error updating salary profile:', err);
      showBanner(err.response?.data?.message || 'Error updating salary profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      const matchSearch = searchTerm === '' ||
        p.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.nameKh && p.nameKh.includes(searchTerm));
      const matchDept = deptFilter === '' || p.departmentName === deptFilter;
      return matchSearch && matchDept;
    });
  }, [profiles, searchTerm, deptFilter]);

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedProfiles = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const uniqueDepartments = Array.from(new Set(profiles.map(p => p.departmentName).filter(Boolean)));
  const totalMonthlyBudget = profiles.reduce((acc, p) => acc + Number(p.baseSalary || 0), 0);
  const avgSalary = profiles.length > 0 ? totalMonthlyBudget / profiles.length : 0;
  const udcCount = profiles.filter(p => p.contractType === 'UDC').length;

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

      {/* Top Header - Matching Reports / AttendanceIncomplete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
            <BriefcaseIcon className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {isKhmer ? 'រចនាសម្ព័ន្ធប្រាក់ខែ & បុគ្គលិក' : 'Employee Salary Profiles'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {isKhmer
                ? 'កំណត់ប្រាក់ខែគោល ប្រភេទកិច្ចសន្យា (UDC/FDC) គណនីធនាគារ បន្ទុកគ្រួសារ និងប្រាក់ឧបត្ថម្ភប្រចាំខែ'
                : 'Manage base salary, contract types, bank info, tax reliefs, and monthly allowances'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchProfiles}
            className="py-2.5 px-4 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <UserGroupIcon className="h-4 w-4 text-indigo-400" />
            <span>{isKhmer ? 'ផ្ទុកទិន្នន័យឡើងវិញ' : 'Refresh Profiles'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Base Salary */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 font-khmer uppercase tracking-wider">
              {isKhmer ? 'ថវិកាប្រាក់ខែគោលសរុប' : 'Total Base Salary'}
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CurrencyDollarIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tracking-tight font-mono">
              ${totalMonthlyBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-khmer">
            {isKhmer ? 'គិតលើបុគ្គលិកសរុប' : 'Across all'} {profiles.length} {isKhmer ? 'នាក់' : 'staff'}
          </p>
        </div>

        {/* Average Salary */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 font-khmer uppercase tracking-wider">
              {isKhmer ? 'ប្រាក់ខែជាមធ្យម' : 'Average Base Salary'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserGroupIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
              ${avgSalary.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-khmer">
            {isKhmer ? 'មធ្យមភាគក្នុងម្នាក់' : 'Average per employee'}
          </p>
        </div>

        {/* Contracts Ratio */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 font-khmer uppercase tracking-wider">
              {isKhmer ? 'កិច្ចសន្យា UDC / FDC' : 'UDC / FDC Ratio'}
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BuildingLibraryIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-400 tracking-tight font-mono">
              {udcCount} <span className="text-sm font-normal text-slate-400">/ {profiles.length - udcCount}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-khmer">
            {udcCount} {isKhmer ? 'កិច្ចសន្យាមិនកំណត់ពេល (UDC)' : 'Undetermined'}
          </p>
        </div>

        {/* Enrolled NSSF */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 font-khmer uppercase tracking-wider">
              {isKhmer ? 'បុគ្គលិកមាន ប.ស.ស' : 'Enrolled in NSSF'}
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-400 tracking-tight font-mono">
              {profiles.filter(p => p.hasNssf).length} <span className="text-sm font-normal text-slate-400">/ {profiles.length}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-khmer">
            {isKhmer ? 'កាត់ភាគទាន ២% ប្រចាំខែ' : 'Subject to 2% monthly deduction'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={isKhmer ? 'ស្វែងរក ឈ្មោះ ឬ អត្តលេខ...' : 'Search staff ID or name...'}
              className="w-full pl-10 pr-4 py-2 border border-white/10 bg-slate-950/60 text-white placeholder-slate-400 rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
          >
            <option value="">{isKhmer ? 'គ្រប់នាយកដ្ឋាន' : 'All Departments'}</option>
            {uniqueDepartments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400 font-khmer">
          {isKhmer ? 'បង្ហាញបុគ្គលិក:' : 'Showing:'} <span className="font-bold text-white font-mono">{filtered.length}</span> {isKhmer ? 'នាក់' : 'staff'}
        </div>
      </div>

      {/* Salary Profiles Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-300 border-b border-white/10 font-khmer text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Staff ID / Name</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5 text-center">Contract</th>
                <th className="p-3.5 text-right font-bold text-amber-400">Base Salary</th>
                <th className="p-3.5">Bank Information</th>
                <th className="p-3.5 text-center">Family / Relief</th>
                <th className="p-3.5 text-center">NSSF</th>
                <th className="p-3.5 text-right">Allowances</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-400 font-khmer">
                    <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    {isKhmer ? 'កំពុងទាញយកព័ត៌មានប្រាក់ខែបុគ្គលិក...' : 'Loading salary profiles...'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-400 font-khmer">
                    {isKhmer ? 'មិនមានទិន្នន័យបុគ្គលិកឡើយ' : 'No employee records found'}
                  </td>
                </tr>
              ) : (
                paginatedProfiles.map((p) => {
                  const allowancesSum = Number(p.transportAllowance || 0) +
                    Number(p.mealAllowance || 0) +
                    Number(p.housingAllowance || 0) +
                    Number(p.phoneAllowance || 0) +
                    Number(p.attendanceAllowance || 0) +
                    Number(p.otherAllowances || 0);

                  return (
                    <tr key={p.staffId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white font-mono">{p.staffId}</div>
                        <div className="text-[11px] text-slate-300 font-khmer">{p.nameEn || p.nameKh}</div>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div>{p.departmentName || '-'}</div>
                        <div className="text-[10px] text-slate-500">{p.positionTitle || '-'}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          p.contractType === 'UDC'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {p.contractType || 'UDC'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-amber-300">
                        <div>
                          {p.salaryCurrency === 'KHR'
                            ? `${Number(p.baseSalary || 0).toLocaleString()} ៛`
                            : `$${Number(p.baseSalary || 0).toFixed(2)}`}
                        </div>
                        <span className={`inline-block px-1.5 py-0.2 text-[9px] rounded font-bold ${
                          p.salaryCurrency === 'KHR'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {p.salaryCurrency || 'USD'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-200">{p.bankName || 'ABA Bank'}</div>
                        <div className="text-[11px] font-mono text-indigo-400">{p.bankAccountNumber || '(No Account)'}</div>
                      </td>
                      <td className="p-3.5 text-center text-[11px] text-slate-300 font-khmer">
                        <div>{p.maritalStatus === 'Married' ? 'រៀបការ' : 'នៅលីវ'}</div>
                        <div className="text-[10px] text-slate-400">
                          កូន {p.dependentChildrenCount || 0} នាក់
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          p.hasNssf
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}>
                          {p.hasNssf ? 'Yes (2%)' : 'No'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        ${allowancesSum.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                          title={isKhmer ? 'កែប្រែប្រាក់ខែ & ព័ត៌មាន' : 'Edit Salary Profile'}
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-white/5 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>{isKhmer ? 'ជួរក្នុងមួយទំព័រ:' : 'Rows per page:'}</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ml-2 font-mono">
              {(currentPage - 1) * pageSize + (totalRecords > 0 ? 1 : 0)} - {Math.min(currentPage * pageSize, totalRecords)} {isKhmer ? 'នៃ' : 'of'} {totalRecords}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-white">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="glass-card bg-slate-900/95 border border-white/15 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <BriefcaseIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-khmer">
                    {isKhmer ? 'កែប្រែព័ត៌មានប្រាក់ខែបុគ្គលិក' : 'Edit Employee Salary Profile'}
                  </h3>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">
                    {editingProfile.staffId} - {editingProfile.nameEn || editingProfile.nameKh} ({editingProfile.departmentName || 'N/A'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Row 1: Base Salary, Currency & Contract */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'ប្រាក់ខែគោល (Base Salary)' : 'Base Salary'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editBaseSalary}
                    onChange={(e) => setEditBaseSalary(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'រូបិយប័ណ្ណ (Currency)' : 'Currency'}
                  </label>
                  <select
                    value={editSalaryCurrency}
                    onChange={(e) => setEditSalaryCurrency(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-khmer font-bold"
                  >
                    <option value="USD">USD ($ - ដុល្លារ)</option>
                    <option value="KHR">KHR (៛ - រៀល)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'ប្រភេទកិច្ចសន្យា' : 'Contract Type'}
                  </label>
                  <select
                    value={editContractType}
                    onChange={(e) => setEditContractType(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-khmer"
                  >
                    <option value="UDC">UDC (មិនកំណត់ពេល)</option>
                    <option value="FDC">FDC (កំណត់ពេល)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Bank Info */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'ធនាគារ (Bank)' : 'Bank Name'}
                  </label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="ABA Bank"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-khmer"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'លេខគណនី (Account No.)' : 'Account Number'}
                  </label>
                  <input
                    type="text"
                    value={editBankAccountNumber}
                    onChange={(e) => setEditBankAccountNumber(e.target.value)}
                    placeholder="000 123 456"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'ឈ្មោះម្ចាស់ (Holder)' : 'Account Name'}
                  </label>
                  <input
                    type="text"
                    value={editBankAccountName}
                    onChange={(e) => setEditBankAccountName(e.target.value)}
                    placeholder="SOK DARA"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Row 3: Family & NSSF */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/10">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'ស្ថានភាពគ្រួសារ' : 'Marital Status'}
                  </label>
                  <select
                    value={editMaritalStatus}
                    onChange={(e) => setEditMaritalStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-khmer"
                  >
                    <option value="Single">នៅលីវ (Single)</option>
                    <option value="Married">រៀបការរួច (Married)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1.5 font-khmer">
                    {isKhmer ? 'កូនក្នុងបន្ទុក (កាត់ពន្ធ)' : 'Dependent Children'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editChildrenCount}
                    onChange={(e) => setEditChildrenCount(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="flex flex-col justify-center pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-khmer">
                    <input
                      type="checkbox"
                      checked={editHasNssf}
                      onChange={(e) => setEditHasNssf(e.target.checked)}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <span className="text-white">{isKhmer ? 'កាត់ ប.ស.ស (NSSF)' : 'Enroll NSSF'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none font-khmer mt-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={editSpouseEligible}
                      onChange={(e) => setEditSpouseEligible(e.target.checked)}
                      className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>{isKhmer ? 'សហព័ទ្ធគ្មានការងារ' : 'Spouse Relief'}</span>
                  </label>
                </div>
              </div>

              {/* Row 4: Monthly Allowances */}
              <div>
                <h4 className="font-bold text-slate-300 font-khmer mb-2 uppercase tracking-wide text-[11px]">
                  {isKhmer ? 'ប្រាក់ឧបត្ថម្ភប្រចាំខែ (Monthly Allowances $)' : 'Monthly Allowances ($)'}
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">សាំង/ធ្វើដំណើរ (Transport)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editTransport}
                      onChange={(e) => setEditTransport(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">ថ្លៃបាយ (Meal)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editMeal}
                      onChange={(e) => setEditMeal(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">កន្លែងស្នាក់នៅ (Housing)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editHousing}
                      onChange={(e) => setEditHousing(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">ទូរស័ព្ទ (Phone)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">វត្តមានទៀងទាត់ (Attendance)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAttendance}
                      onChange={(e) => setEditAttendance(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-khmer">ផ្សេងៗ (Other)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editOther}
                      onChange={(e) => setEditOther(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1 font-khmer">
                  {isKhmer ? 'កំណត់សម្គាល់ (Note)' : 'Note'}
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows="2"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-khmer"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-semibold cursor-pointer font-khmer transition-all"
                >
                  {isKhmer ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 font-khmer"
                >
                  {saving ? (isKhmer ? 'កំពុងរក្សាទុក...' : 'Saving...') : (isKhmer ? 'រក្សាទុកព័ត៌មាន' : 'Save Profile')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollSalaryStructure;
