import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  DocumentArrowDownIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { formatTime12Hour } from './Attendance';

const Reports = () => {
  const { t, getLocalizedName } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (filterDept) query += `&departmentId=${filterDept}`;
      if (filterBranch) query += `&branch=${filterBranch}`;

      const response = await api.get(`/attendances/history${query}`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching reports logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, filterDept, filterBranch]);

  // Statistics summaries
  const totalDaysLog = logs.length;
  const totalLate = logs.filter(log => log.isLate).length;
  const totalEarlyLeave = logs.filter(log => log.isEarlyLeave).length;
  const onLeaveCount = logs.filter(log => !(log.checkin1 || log.checkin2)).length;
  const onTimeCount = totalDaysLog - totalLate - totalEarlyLeave - onLeaveCount;

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;

    // Header row
    const headers = [
      'Staff ID',
      'Employee Name (EN)',
      'Employee Name (KH)',
      'Department',
      'Date',
      'Check-in 1',
      'Check-out 1',
      'Check-in 2',
      'Check-out 2',
      'Is Late',
      'Is Early Leave',
      'Note'
    ];

    // Map logs to CSV rows
    const rows = logs.map(log => [
      log.employee.staffId,
      log.employee.nameEn,
      log.employee.nameKh,
      log.employee.department.nameEn,
      new Date(log.attendanceDate).toLocaleDateString(),
      log.checkin1 || '',
      log.checkout1 || '',
      log.checkin2 || '',
      log.checkout2 || '',
      log.isLate ? 'YES' : 'NO',
      log.isEarlyLeave ? 'YES' : 'NO',
      log.note || ''
    ]);

    // Construct CSV Content
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Unicode Byte Order Mark (BOM) to support Khmer unicode letters in Excel correctly
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex justify-between items-center glass-card p-6 rounded-2xl border border-white/10 shadow-sm no-print glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("reports")}</h2>
          <p className="text-slate-400 text-xs mt-1">Export database analytics and shifts reports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border border-indigo-500/20 font-khmer disabled:opacity-50 cursor-pointer outline-none"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            {t("exportExcel")}
          </button>
          <button
            onClick={handlePrint}
            disabled={logs.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer disabled:opacity-50 cursor-pointer border-none outline-none"
          >
            <PrinterIcon className="h-5 w-5" />
            {t("printPdf")}
          </button>
        </div>
      </div>

      {/* Print-only Invoice Header */}
      <div className="hidden print-only text-center space-y-2 mb-8">
        <h1 className="text-2xl font-bold font-khmer text-slate-900 uppercase">
          {t("attendanceReport")}
        </h1>
        <p className="text-sm text-slate-500 font-khmer">
          សាខា (Branch): {filterBranch || t("all")} • ថ្ងៃចាប់ផ្តើម (Period): {startDate} ដល់ {endDate}
        </p>
        <div className="h-px bg-slate-300 w-full my-4"></div>
      </div>

      {/* Search Filter Panel */}
      <div className="glass-card p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
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
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("departments")}</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
          >
            <option value="" className="bg-slate-900">{t("selectDept")} ({t("all")})</option>
            {departments.map(d => (
              <option key={d.id} value={d.id} className="bg-slate-900">{getLocalizedName(d.nameEn, d.nameKh)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t("branch")}</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all"
          >
            <option value="" className="bg-slate-900">{t("branch")} ({t("all")})</option>
            <option value="Phnom Penh HQ" className="bg-slate-900">Phnom Penh HQ</option>
            <option value="Siem Reap Branch" className="bg-slate-900">Siem Reap Branch</option>
          </select>
        </div>
      </div>

      {/* Reports Summary KPI Panel */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print-card">
        <div className="glass-card p-5 rounded-2xl text-center print:border-slate-300">
          <span className="block text-xs text-slate-400 font-medium font-khmer">សំណុំទិន្នន័យ (Logs)</span>
          <span className="block text-2xl font-bold mt-1 text-white">{totalDaysLog}</span>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center print:border-slate-300">
          <span className="block text-xs text-slate-400 font-medium font-khmer">{t("normal")}</span>
          <span className="block text-2xl font-bold mt-1 text-emerald-400">{onTimeCount}</span>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center print:border-slate-300">
          <span className="block text-xs text-slate-400 font-medium font-khmer">{t("lateToday")}</span>
          <span className="block text-2xl font-bold mt-1 text-amber-400">{totalLate}</span>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center print:border-slate-300">
          <span className="block text-xs text-slate-400 font-medium font-khmer">{t("earlyLeaveToday")}</span>
          <span className="block text-2xl font-bold mt-1 text-rose-400">{totalEarlyLeave}</span>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center print:border-slate-300 col-span-2 md:col-span-1">
          <span className="block text-xs text-slate-400 font-medium font-khmer">{t("onLeaveToday")}</span>
          <span className="block text-2xl font-bold mt-1 text-sky-400">{onLeaveCount}</span>
        </div>
      </div>

      {/* Main Reports Table */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 print:text-xs">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10 print:bg-slate-100">
                <tr>
                  <th className="py-4 px-6 font-khmer">{t("leaveDate")}</th>
                  <th className="py-4 px-6 font-khmer">{t("staffId")}</th>
                  <th className="py-4 px-6 font-khmer">{t("employees")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkin1")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkout1")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkin2")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkout2")}</th>
                  <th className="py-4 px-6 font-khmer">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                      <td className="py-4 px-6 font-semibold text-white">
                        {new Date(log.attendanceDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 font-semibold text-white">{log.employee.staffId}</td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-white">
                            {getLocalizedName(log.employee.nameEn, log.employee.nameKh)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {getLocalizedName(log.employee.department.nameEn, log.employee.department.nameKh)}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">{formatTime12Hour(log.checkin1)}</td>
                      <td className="py-4 px-6">{formatTime12Hour(log.checkout1)}</td>
                      <td className="py-4 px-6">{formatTime12Hour(log.checkin2)}</td>
                      <td className="py-4 px-6">{formatTime12Hour(log.checkout2)}</td>
                      <td className="py-4 px-6 space-y-1">
                        {log.isLate && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20 font-khmer">
                            {t("late")}
                          </span>
                        )}
                        {log.isEarlyLeave && (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20 font-khmer ml-1">
                            {t("earlyLeave")}
                          </span>
                        )}
                        {!log.isLate && !log.isEarlyLeave && (log.checkin1 || log.checkin2) && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                            {t("normal")}
                          </span>
                        )}
                        {!(log.checkin1 || log.checkin2) && (
                          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20 font-khmer">
                            On Leave
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
