import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  DocumentTextIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import khyhengLogoDefault from '../assets/khyheng_logo.png';

const PayrollPayslips = () => {
  const { locale, language } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';
  const [searchParams] = useSearchParams();

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(searchParams.get('runId') || '');
  const [currentRun, setCurrentRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('staffId') || '');
  const [selectedStaffId, setSelectedStaffId] = useState(searchParams.get('staffId') || 'ALL');
  const [deptFilter, setDeptFilter] = useState('');

  const printAreaRef = useRef(null);

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
        await fetchRunData(targetId);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunData = async (runId) => {
    if (!runId) return;
    try {
      setLoading(true);
      const [runRes, slipsRes] = await Promise.all([
        api.get(`/payroll/runs/${runId}`),
        api.get(`/payroll/runs/${runId}/payslips`)
      ]);
      setCurrentRun(runRes.data);
      setPayslips(slipsRes.data || []);
    } catch (err) {
      console.error('Error fetching slips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleRunChange = (runId) => {
    setSelectedRunId(runId);
    fetchRunData(runId);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredSlips = payslips.filter(p => {
    const matchStaff = selectedStaffId === 'ALL' || p.staffId === selectedStaffId;
    const matchSearch = searchTerm === '' ||
      p.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.employeeNameEn && p.employeeNameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.employeeNameKh && p.employeeNameKh.includes(searchTerm));
    const matchDept = deptFilter === '' || p.departmentName === deptFilter;
    return matchStaff && matchSearch && matchDept;
  });

  const uniqueDepartments = Array.from(new Set(payslips.map(p => p.departmentName).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12 text-slate-100">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          nav, aside, header, .no-print, button, input, select {
            display: none !important;
          }
          #root, main, div[class*="md:pl-64"] {
            overflow: visible !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .payslip-print-card {
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            color: #000000 !important;
            background: #ffffff !important;
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 20px !important;
            padding: 14px 18px !important;
          }
          .payslip-table th, .payslip-table td {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            padding: 4px 6px !important;
            font-size: 9.5pt !important;
          }
          .payslip-header-muol {
            font-family: 'Khmer OS Muol Light', 'Moul', serif !important;
          }
        }
      `}</style>

      {/* Top Header - Matching Reports / AttendanceIncomplete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
            <DocumentTextIcon className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {isKhmer ? 'ប័ណ្ណបើកប្រាក់បៀវត្សរ៍' : 'Employee Payslips'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {isKhmer
                ? 'ពិនិត្យ និងបោះពុម្ពប័ណ្ណបើកប្រាក់ខែបុគ្គលិកផ្លូវការ ជាមួយព័ត៌មានលម្អិត Gross, Deductions និង Net Pay'
                : 'Preview, customize and print official monthly employee payslips with full deductions breakdown'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={filteredSlips.length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 font-khmer flex items-center gap-2 border-none"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>{isKhmer ? 'បោះពុម្ពប័ណ្ណ Payslips' : 'Print Payslips'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Toolbar (No Print) */}
      <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg no-print">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Cycle Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-khmer">{isKhmer ? 'វដ្តប្រាក់ខែ:' : 'Cycle:'}</span>
            <select
              value={selectedRunId}
              onChange={(e) => handleRunChange(e.target.value)}
              className="py-2 px-3 border border-white/10 bg-slate-950/60 text-indigo-300 font-bold rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
            >
              {runs.map(r => (
                <option key={r.id} value={r.id} className="text-white bg-slate-900">
                  {r.title} ({r.totalEmployees} {isKhmer ? 'នាក់' : 'staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
          >
            <option value="">{isKhmer ? 'គ្រប់នាយកដ្ឋាន' : 'All Departments'}</option>
            {uniqueDepartments.map(d => (
              <option key={d} value={d} className="text-white bg-slate-900">{d}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isKhmer ? 'ស្វែងរក ឈ្មោះ ឬ ID...' : 'Search staff...'}
              className="w-full pl-10 pr-4 py-2 border border-white/10 bg-slate-950/60 text-white placeholder-slate-400 rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-khmer">
          {isKhmer ? 'ចំនួនប័ណ្ណ:' : 'Payslips count:'} <span className="font-bold text-white font-mono">{filteredSlips.length}</span> {isKhmer ? 'សន្លឹក' : 'slips'}
        </div>
      </div>

      {/* Printable Payslips Container */}
      <div ref={printAreaRef} className="space-y-8">
        {loading ? (
          <div className="glass-card p-12 text-center text-slate-400 font-khmer rounded-2xl no-print border border-white/10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p>{isKhmer ? 'កំពុងទាញយកប័ណ្ណបើកប្រាក់ខែ...' : 'Loading payslips...'}</p>
          </div>
        ) : filteredSlips.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400 font-khmer rounded-2xl no-print border border-white/10">
            {isKhmer ? 'មិនមានទិន្នន័យប័ណ្ណបើកប្រាក់ខែឡើយ' : 'No payslips found'}
          </div>
        ) : (
          filteredSlips.map((p) => {
            return (
              <div
                key={p.id}
                className="payslip-print-card bg-white text-black p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-300 max-w-4xl mx-auto space-y-4"
              >
                {/* Payslip Header with Logo */}
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={khyhengLogoDefault}
                      alt="Company Logo"
                      className="h-14 sm:h-16 object-contain"
                    />
                    <div>
                      <h2 className="font-khmer font-bold text-black text-sm tracking-wide">
                        ក្រុមហ៊ុន ឃី ហេង អ៊ិនវេសមេន ឯ.ក
                      </h2>
                      <h3 className="text-xs font-semibold text-gray-700 tracking-wider">
                        KHY HENG INVESTMENT CO., LTD.
                      </h3>
                    </div>
                  </div>

                  <div className="text-right">
                    <h1 className="payslip-header-muol text-lg sm:text-xl font-bold text-black font-khmer">
                      ប័ណ្ណបើកប្រាក់បៀវត្សរ៍
                    </h1>
                    <div className="text-xs font-bold text-gray-800 tracking-wider">
                      PAYSLIP - {currentRun ? `MONTH ${currentRun.month}/${currentRun.year}` : ''}
                    </div>
                    <div className="text-[11px] text-gray-600 font-mono">
                      (1 USD = {currentRun?.exchangeRateKhr?.toLocaleString()} KHR)
                    </div>
                  </div>
                </div>

                {/* Employee Info Grid Table */}
                <table className="payslip-table w-full border-collapse border border-black text-xs">
                  <tbody>
                    <tr>
                      <td className="font-khmer font-semibold bg-gray-100 w-1/4">ឈ្មោះបុគ្គលិក / Name:</td>
                      <td className="font-bold w-1/4 font-khmer">{p.employeeNameKh || p.employeeNameEn} ({p.employeeNameEn})</td>
                      <td className="font-khmer font-semibold bg-gray-100 w-1/4">អត្តលេខ / Staff ID:</td>
                      <td className="font-mono font-bold w-1/4">{p.staffId}</td>
                    </tr>
                    <tr>
                      <td className="font-khmer font-semibold bg-gray-100">នាយកដ្ឋាន / Department:</td>
                      <td>{p.departmentName || '-'}</td>
                      <td className="font-khmer font-semibold bg-gray-100">តួនាទី / Position:</td>
                      <td>{p.positionTitle || '-'}</td>
                    </tr>
                    <tr>
                      <td className="font-khmer font-semibold bg-gray-100">កិច្ចសន្យា / Contract:</td>
                      <td className="font-bold">{p.contractType}</td>
                      <td className="font-khmer font-semibold bg-gray-100">ធនាគារ / Bank Info:</td>
                      <td className="font-mono">{p.bankName} - {p.bankAccountNumber || 'Cash'}</td>
                    </tr>
                    <tr>
                      <td className="font-khmer font-semibold bg-gray-100">ថ្ងៃធ្វើការ / Working Days:</td>
                      <td className="font-mono font-bold">{p.workedDays} / {p.standardWorkingDays} ថ្ងៃ</td>
                      <td className="font-khmer font-semibold bg-gray-100">ម៉ោងថែម / Overtime:</td>
                      <td className="font-mono font-bold">
                        {(Number(p.normalOtHours) + Number(p.holidayOtHours)).toFixed(1)} ម៉ោង
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Two-Column Breakdown: Earnings vs Deductions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Column 1: Earnings */}
                  <div>
                    <h4 className="font-khmer font-bold text-xs bg-emerald-700 text-white px-2.5 py-1 uppercase tracking-wide">
                      ១. ប្រាក់បៀវត្ស & ប្រាក់បន្ថែម (EARNINGS)
                    </h4>
                    <table className="payslip-table w-full border-collapse border border-black text-xs">
                      <tbody>
                        <tr>
                          <td>ប្រាក់ខែគោល (Base Salary)</td>
                          <td className="text-right font-mono font-bold">${Number(p.baseSalary || 0).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>ប្រាក់ខែតាមថ្ងៃជាក់ស្តែង (Payable Base)</td>
                          <td className="text-right font-mono">${Number(p.baseSalaryPayable || 0).toFixed(2)}</td>
                        </tr>
                        {Number(p.normalOtAmount) > 0 && (
                          <tr>
                            <td>ថែមម៉ោងធម្មតា 150% ({p.normalOtHours}h)</td>
                            <td className="text-right font-mono">${Number(p.normalOtAmount).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.holidayOtAmount) > 0 && (
                          <tr>
                            <td>ថែមម៉ោងបុណ្យ/យប់ 200% ({p.holidayOtHours}h)</td>
                            <td className="text-right font-mono">${Number(p.holidayOtAmount).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.transportAllowance) > 0 && (
                          <tr>
                            <td>ថ្លៃសាំង / ធ្វើដំណើរ (Transport)</td>
                            <td className="text-right font-mono">${Number(p.transportAllowance).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.mealAllowance) > 0 && (
                          <tr>
                            <td>ថ្លៃបាយ (Meal Allowance)</td>
                            <td className="text-right font-mono">${Number(p.mealAllowance).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.housingAllowance) > 0 && (
                          <tr>
                            <td>កន្លែងស្នាក់នៅ (Housing Allowance)</td>
                            <td className="text-right font-mono">${Number(p.housingAllowance).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.phoneAllowance) > 0 && (
                          <tr>
                            <td>កាតទូរស័ព្ទ (Phone Allowance)</td>
                            <td className="text-right font-mono">${Number(p.phoneAllowance).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.attendanceAllowance) > 0 && (
                          <tr>
                            <td>វត្តមានទៀងទាត់ (Attendance)</td>
                            <td className="text-right font-mono">${Number(p.attendanceAllowance).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.bonusAmount) > 0 && (
                          <tr>
                            <td>ប្រាក់លើកទឹកចិត្ត (Bonus)</td>
                            <td className="text-right font-mono">${Number(p.bonusAmount).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.seniorityIndemnity) > 0 && (
                          <tr>
                            <td>ប្រាក់បំណាច់អតីតភាព (Seniority UDC)</td>
                            <td className="text-right font-mono font-bold">${Number(p.seniorityIndemnity).toFixed(2)}</td>
                          </tr>
                        )}
                        <tr className="bg-gray-100 font-bold">
                          <td className="font-khmer">ប្រាក់បៀវត្សសរុប (GROSS SALARY):</td>
                          <td className="text-right font-mono text-emerald-900">${Number(p.grossSalary || 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Column 2: Deductions */}
                  <div>
                    <h4 className="font-khmer font-bold text-xs bg-rose-700 text-white px-2.5 py-1 uppercase tracking-wide">
                      ២. ការកាត់ប្រាក់ (DEDUCTIONS)
                    </h4>
                    <table className="payslip-table w-full border-collapse border border-black text-xs">
                      <tbody>
                        <tr>
                          <td>មកយឺត ({p.lateMinutes || 0} នាទី)</td>
                          <td className="text-right font-mono text-rose-800">
                            -${Number(p.lateDeductionAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td>ឈប់ឥតច្បាប់ ({p.unpaidLeaveDays || 0} ថ្ងៃ)</td>
                          <td className="text-right font-mono text-rose-800">
                            -${Number(p.unpaidLeaveDeductionAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td>ប.ស.ស និយោជិត (NSSF 2%)</td>
                          <td className="text-right font-mono text-rose-800">
                            -${Number(p.nssfEmployeeAmount || 0).toFixed(2)} ({Number(p.nssfEmployeeKhr || 0).toLocaleString()}៛)
                          </td>
                        </tr>
                        <tr>
                          <td>ពន្ធលើប្រាក់បៀវត្សរ៍ (TOS Tax)</td>
                          <td className="text-right font-mono text-rose-800">
                            -${Number(p.taxOnSalaryAmount || 0).toFixed(2)} ({Number(p.taxOnSalaryKhr || 0).toLocaleString()}៛)
                          </td>
                        </tr>
                        {Number(p.advanceDeduction) > 0 && (
                          <tr>
                            <td>កាត់ប្រាក់បុរេប្រទាន (Advance Loan)</td>
                            <td className="text-right font-mono text-rose-800">-${Number(p.advanceDeduction).toFixed(2)}</td>
                          </tr>
                        )}
                        {Number(p.otherDeductions) > 0 && (
                          <tr>
                            <td>ការកាត់ផ្សេងៗ (Other Deductions)</td>
                            <td className="text-right font-mono text-rose-800">-${Number(p.otherDeductions).toFixed(2)}</td>
                          </tr>
                        )}
                        <tr className="bg-gray-100 font-bold">
                          <td className="font-khmer">ការកាត់សរុប (TOTAL DEDUCTIONS):</td>
                          <td className="text-right font-mono text-rose-900">-${Number(p.totalDeductions || 0).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Salary Highlight Box */}
                <div className="p-3.5 bg-emerald-50 border-2 border-emerald-600 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-khmer font-bold text-emerald-950 text-sm block">
                      ប្រាក់ខែសុទ្ធត្រូវបើក (NET SALARY PAYABLE):
                    </span>
                    <span className="text-xs text-gray-600 font-khmer">
                      សមមូលប្រាក់រៀល: <span className="font-mono font-bold text-black">{Number(p.netSalaryKhr || 0).toLocaleString()} KHR</span>
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-700">
                    ${Number(p.netSalary || 0).toFixed(2)} USD
                  </div>
                </div>

                {/* Signatures Section */}
                <div className="grid grid-cols-3 gap-6 pt-4 text-center text-xs font-khmer">
                  <div>
                    <div className="font-bold mb-12">រៀបចំដោយ / Prepared By</div>
                    <div className="border-t border-dotted border-black pt-1">
                      <span>ហត្ថលេខា / កាលបរិច្ឆេទ</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold mb-12">បានត្រួតពិនិត្យ / Checked By</div>
                    <div className="border-t border-dotted border-black pt-1">
                      <span>ហត្ថលេខា / កាលបរិច្ឆេទ</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold mb-12">យល់ព្រមដោយ / Approved By</div>
                    <div className="border-t border-dotted border-black pt-1">
                      <span>ត្រា & ហត្ថលេខា / កាលបរិច្ឆេទ</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PayrollPayslips;
