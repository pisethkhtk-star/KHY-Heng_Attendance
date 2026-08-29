import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  CalendarIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const getEmployeePhoto = (emp) => {
  if (!emp) return null;
  if (emp.photoUrl) return emp.photoUrl;
  if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
  if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
  return null;
};

const LeaveReport = () => {
  const { language, t, getLocalizedName, locale } = useLanguage();

  const [leaves, setLeaves] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchInitialData = async () => {
    try {
      const [deptRes, empRes, ltRes] = await Promise.all([
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/leave-types').catch(() => ({ data: [] })),
      ]);
      setDepartments(deptRes.data || []);
      setEmployees(empRes.data || []);
      setLeaveTypes(ltRes.data || []);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/leaves');
      setLeaves(res.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchLeaves();
  }, []);

  // Filtered leaves according to all criteria
  const filteredLeaves = useMemo(() => {
    return leaves.filter((item) => {
      // Date range filter
      const itemDate = item.startDate || item.leaveDate || (item.createdAt ? item.createdAt.split('T')[0] : '');
      if (startDate && itemDate && itemDate < startDate) return false;
      if (endDate && itemDate && itemDate > endDate) return false;

      // Status filter
      if (filterStatus && item.status !== filterStatus) return false;

      // Leave type filter
      if (filterLeaveType && item.leaveType !== filterLeaveType) return false;

      // Department filter
      if (filterDept) {
        const emp = item.employee;
        const deptId = emp?.departmentId || emp?.department?.id;
        const deptNameEn = emp?.department?.nameEn;
        const matchDept = departments.find(d => String(d.id) === String(filterDept));
        if (deptId && String(deptId) !== String(filterDept)) return false;
        if (!deptId && matchDept && deptNameEn !== matchDept.nameEn) return false;
      }

      // Branch filter
      if (filterBranch) {
        const empBranch = item.employee?.branch;
        if (empBranch && empBranch !== filterBranch) return false;
      }

      // Search query (Staff ID or Name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const staffId = (item.staffId || '').toLowerCase();
        const nameEn = (item.employee?.nameEn || item.employeeName || '').toLowerCase();
        const nameKh = (item.employee?.nameKh || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        if (!staffId.includes(q) && !nameEn.includes(q) && !nameKh.includes(q) && !reason.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [leaves, startDate, endDate, filterStatus, filterLeaveType, filterDept, filterBranch, searchQuery, departments]);

  // Statistics & KPI
  const stats = useMemo(() => {
    const totalRequests = filteredLeaves.length;
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalDaysApproved = 0;
    let totalDaysAll = 0;

    filteredLeaves.forEach(l => {
      const days = Number(l.amountDays) || 1;
      totalDaysAll += days;
      if (l.status === 'Approved') {
        approved++;
        totalDaysApproved += days;
      } else if (l.status === 'Pending') {
        pending++;
      } else if (l.status === 'Rejected') {
        rejected++;
      }
    });

    const uniqueStaff = new Set(filteredLeaves.map(l => l.staffId).filter(Boolean)).size;

    return {
      totalRequests,
      approved,
      pending,
      rejected,
      totalDaysApproved: Math.round(totalDaysApproved * 10) / 10,
      totalDaysAll: Math.round(totalDaysAll * 10) / 10,
      uniqueStaff,
    };
  }, [filteredLeaves]);

  // Leave Type Breakdown - 100% dynamic based on Leave Types
  const typeBreakdown = useMemo(() => {
    const activeTypes = [];
    const seenKeys = new Set();

    (leaveTypes || []).forEach(lt => {
      const key = (lt.code || lt.nameEn || '').trim().toUpperCase();
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        activeTypes.push({
          id: lt.id,
          code: lt.code || lt.nameEn,
          nameEn: lt.nameEn || lt.code,
          nameKh: lt.nameKh || '',
          label: getLocalizedName(lt.nameEn, lt.nameKh) || lt.code,
        });
      }
    });

    // Fallback if leaveTypes is empty
    if (activeTypes.length === 0) {
      [
        { code: 'AL', nameEn: 'Annual Leave', nameKh: 'ច្បាប់សម្រាកប្រចាំឆ្នាំ', label: language === 'kh' ? 'ច្បាប់សម្រាកប្រចាំឆ្នាំ' : 'Annual Leave' },
        { code: 'SL', nameEn: 'Sick Leave', nameKh: 'ច្បាប់ឈឺ', label: language === 'kh' ? 'ច្បាប់ឈឺ' : 'Sick Leave' },
        { code: 'PL', nameEn: 'Personal Leave', nameKh: 'ច្បាប់ផ្ទាល់ខ្លួន', label: language === 'kh' ? 'ច្បាប់ផ្ទាល់ខ្លួន' : 'Personal Leave' },
      ].forEach(t => {
        seenKeys.add(t.code.toUpperCase());
        activeTypes.push(t);
      });
    }

    const isMatch = (leaveTypeVal, target) => {
      const c = (leaveTypeVal || '').trim();
      const cUpper = c.toUpperCase();
      const codeUpper = (target.code || '').toUpperCase();
      const nameEnUpper = (target.nameEn || '').toUpperCase();

      if (cUpper === codeUpper) return true;
      if (nameEnUpper && cUpper === nameEnUpper) return true;

      // Standard synonyms to prevent duplicate categories like "AL" and "Annual Leave"
      if (codeUpper === 'AL' && (cUpper === 'ANNUAL LEAVE' || cUpper === 'ANNUAL' || cUpper.startsWith('AL'))) return true;
      if (codeUpper === 'SL' && (cUpper === 'SICK LEAVE' || cUpper === 'SICK' || cUpper.startsWith('SL'))) return true;
      if ((codeUpper === 'PL' || codeUpper === 'SP') && (cUpper === 'PL' || cUpper === 'SP' || cUpper.includes('PERSONAL') || cUpper.includes('SPECIAL'))) return true;
      if (codeUpper === 'ML' && (cUpper === 'ML' || cUpper.includes('MATERNITY') || cUpper.includes('MEDICAL'))) return true;
      if ((codeUpper === 'UP' || codeUpper === 'UL') && (cUpper === 'UP' || cUpper === 'UL' || cUpper.includes('UNPAID'))) return true;

      return false;
    };

    const statsMap = {};
    activeTypes.forEach(t => {
      statsMap[t.code] = { count: 0, days: 0 };
    });

    const unmatched = {};

    filteredLeaves.forEach(l => {
      const val = l.leaveType || '';
      const days = Number(l.amountDays) || 1;

      let matchedType = null;
      for (const t of activeTypes) {
        if (isMatch(val, t)) {
          matchedType = t;
          break;
        }
      }

      if (matchedType) {
        statsMap[matchedType.code].count += 1;
        statsMap[matchedType.code].days += days;
      } else if (val) {
        if (!unmatched[val]) unmatched[val] = { count: 0, days: 0 };
        unmatched[val].count += 1;
        unmatched[val].days += days;
      }
    });

    const result = activeTypes.map(t => {
      const data = statsMap[t.code] || { count: 0, days: 0 };
      return {
        code: t.code,
        label: t.label,
        count: data.count,
        days: Math.round(data.days * 10) / 10,
        percentage: stats.totalRequests > 0 ? Math.round((data.count / stats.totalRequests) * 100) : 0,
      };
    });

    // Add any unmatched custom types that exist in leave records
    Object.entries(unmatched).forEach(([code, data]) => {
      result.push({
        code,
        label: code,
        count: data.count,
        days: Math.round(data.days * 10) / 10,
        percentage: stats.totalRequests > 0 ? Math.round((data.count / stats.totalRequests) * 100) : 0,
      });
    });

    return result.sort((a, b) => b.count - a.count);
  }, [filteredLeaves, leaveTypes, stats.totalRequests, getLocalizedName, language]);

  // Department Breakdown - 100% dynamic based on Departments list
  const deptBreakdown = useMemo(() => {
    const targetDepts = filterDept
      ? departments.filter(d => String(d.id) === String(filterDept) || d.nameEn === filterDept)
      : departments;

    if (targetDepts.length === 0 && departments.length === 0) {
      const map = {};
      filteredLeaves.forEach(l => {
        const deptName = l.employee?.department?.nameEn || 'Unassigned';
        if (!map[deptName]) {
          map[deptName] = { count: 0, days: 0, nameKh: l.employee?.department?.nameKh || '' };
        }
        map[deptName].count++;
        map[deptName].days += Number(l.amountDays) || 1;
      });

      return Object.entries(map).map(([nameEn, data]) => ({
        nameEn,
        label: getLocalizedName(nameEn, data.nameKh || nameEn),
        count: data.count,
        days: Math.round(data.days * 10) / 10,
        percentage: stats.totalRequests > 0 ? Math.round((data.count / stats.totalRequests) * 100) : 0,
      })).sort((a, b) => b.count - a.count);
    }

    return targetDepts.map(dept => {
      const deptLeaves = filteredLeaves.filter(lv => {
        const emp = lv.employee || {};
        const matchesDept = String(emp.departmentId) === String(dept.id) ||
                            String(emp.department?.id) === String(dept.id) ||
                            (emp.department?.nameEn && dept.nameEn && emp.department.nameEn === dept.nameEn);
        if (!matchesDept) return false;
        if (filterBranch && emp.branch !== filterBranch) return false;
        return true;
      });

      const count = deptLeaves.length;
      let days = 0;
      deptLeaves.forEach(lv => {
        days += Number(lv.amountDays) || 1;
      });

      return {
        id: dept.id,
        nameEn: dept.nameEn,
        label: getLocalizedName(dept.nameEn, dept.nameKh) || dept.nameEn,
        count,
        days: Math.round(days * 10) / 10,
        percentage: stats.totalRequests > 0 ? Math.round((count / stats.totalRequests) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);
  }, [departments, filteredLeaves, filterDept, filterBranch, stats.totalRequests, getLocalizedName]);

  // Calculate Department Leave Metrics Breakdown taking columns directly from Leave Types
  const departmentStats = useMemo(() => {
    const targetDepts = filterDept
      ? departments.filter(d => String(d.id) === String(filterDept) || d.nameEn === filterDept)
      : departments;

    if (targetDepts.length === 0) return { typeList: [], deptList: [] };

    // Build dynamic columns directly from server leave types
    const typeList = [];
    const seenCodes = new Set();

    (leaveTypes || []).forEach(lt => {
      const code = (lt.code || lt.nameEn || '').trim();
      const codeUpper = code.toUpperCase();
      if (code && !seenCodes.has(codeUpper)) {
        seenCodes.add(codeUpper);
        typeList.push({
          code: code,
          nameEn: lt.nameEn,
          nameKh: lt.nameKh,
          labelKh: lt.nameKh ? `${code} (${lt.nameKh})` : code,
          labelEn: code,
        });
      }
    });

    // Fallback if leaveTypes from server is empty
    if (typeList.length === 0) {
      [
        { code: 'AL', nameEn: 'Annual Leave', nameKh: 'ប្រចាំឆ្នាំ', labelKh: 'AL (ប្រចាំឆ្នាំ)', labelEn: 'AL' },
        { code: 'SL', nameEn: 'Sick Leave', nameKh: 'ច្បាប់ឈឺ', labelKh: 'SL (ច្បាប់ឈឺ)', labelEn: 'SL' },
        { code: 'PL', nameEn: 'Personal Leave', nameKh: 'ផ្ទាល់ខ្លួន', labelKh: 'PL (ផ្ទាល់ខ្លួន)', labelEn: 'PL' },
      ].forEach(t => {
        seenCodes.add(t.code.toUpperCase());
        typeList.push(t);
      });
    }

    const isMatch = (leaveTypeVal, target) => {
      const c = (leaveTypeVal || '').trim();
      const cUpper = c.toUpperCase();
      const codeUpper = (target.code || '').toUpperCase();
      const nameEnUpper = (target.nameEn || '').toUpperCase();

      if (cUpper === codeUpper) return true;
      if (nameEnUpper && cUpper === nameEnUpper) return true;

      // Standard synonyms
      if (codeUpper === 'AL' && (cUpper === 'ANNUAL LEAVE' || cUpper === 'ANNUAL' || cUpper.startsWith('AL'))) return true;
      if (codeUpper === 'SL' && (cUpper === 'SICK LEAVE' || cUpper === 'SICK' || cUpper.startsWith('SL'))) return true;
      if ((codeUpper === 'PL' || codeUpper === 'SP') && (cUpper === 'PL' || cUpper === 'SP' || cUpper.includes('PERSONAL') || cUpper.includes('SPECIAL'))) return true;
      if (codeUpper === 'ML' && (cUpper === 'ML' || cUpper.includes('MATERNITY') || cUpper.includes('MEDICAL'))) return true;
      if ((codeUpper === 'UP' || codeUpper === 'UL') && (cUpper === 'UP' || cUpper === 'UL' || cUpper.includes('UNPAID'))) return true;

      return false;
    };

    const deptList = targetDepts.map(dept => {
      const deptEmployees = employees.filter(e => {
        const matchesDept = String(e.departmentId) === String(dept.id) ||
                            String(e.department?.id) === String(dept.id) ||
                            (e.department?.nameEn && dept.nameEn && e.department.nameEn === dept.nameEn);
        if (!matchesDept) return false;
        if (filterBranch && e.branch !== filterBranch) return false;
        if (e.status === 'Inactive' || e.status === 'Resigned' || e.status === 'Terminated') return false;
        return true;
      });

      // Filter leaves that belong to this department
      const deptLeaves = filteredLeaves.filter(lv => {
        const emp = lv.employee || {};
        const matchesDept = String(emp.departmentId) === String(dept.id) ||
                            String(emp.department?.id) === String(dept.id) ||
                            (emp.department?.nameEn && dept.nameEn && emp.department.nameEn === dept.nameEn);
        if (!matchesDept) return false;
        if (filterBranch && emp.branch !== filterBranch) return false;
        return true;
      });

      const totalRequests = deptLeaves.length;
      let totalDays = 0;
      const typeCounts = {};
      const typeDays = {};

      typeList.forEach(t => {
        typeCounts[t.code] = 0;
        typeDays[t.code] = 0;
      });

      deptLeaves.forEach(lv => {
        const days = Number(lv.amountDays) || 1;
        totalDays += days;

        let matched = false;
        for (const t of typeList) {
          if (isMatch(lv.leaveType, t)) {
            typeCounts[t.code] = (typeCounts[t.code] || 0) + 1;
            typeDays[t.code] = (typeDays[t.code] || 0) + days;
            matched = true;
            break;
          }
        }
        if (!matched) {
          typeCounts['OTHER'] = (typeCounts['OTHER'] || 0) + 1;
          typeDays['OTHER'] = (typeDays['OTHER'] || 0) + days;
        }
      });

      return {
        id: dept.id,
        nameEn: dept.nameEn,
        nameKh: dept.nameKh,
        displayName: getLocalizedName(dept.nameEn, dept.nameKh),
        employeeCount: deptEmployees.length,
        typeCounts,
        typeDays,
        totalDays: Math.round(totalDays * 10) / 10,
        totalRequests,
      };
    });

    return { typeList, deptList };
  }, [departments, employees, filteredLeaves, leaveTypes, filterDept, filterBranch, getLocalizedName]);

  // Column Totals for Department Summary Table (as requested in user's screenshot)
  const columnTotals = useMemo(() => {
    const typeTotals = {};
    (departmentStats.typeList || []).forEach(t => {
      typeTotals[t.code] = 0;
    });
    let totalStaff = 0;
    let grandTotalDays = 0;
    let grandTotalRequests = 0;

    (departmentStats.deptList || []).forEach(dept => {
      totalStaff += Number(dept.employeeCount) || 0;
      grandTotalDays += Number(dept.totalDays) || 0;
      grandTotalRequests += Number(dept.totalRequests) || 0;
      (departmentStats.typeList || []).forEach(t => {
        typeTotals[t.code] = (typeTotals[t.code] || 0) + (Number(dept.typeDays[t.code]) || 0);
      });
    });

    return {
      totalStaff,
      typeTotals,
      grandTotalDays: Math.round(grandTotalDays * 10) / 10,
      grandTotalRequests,
    };
  }, [departmentStats]);

  // Pagination
  const totalPages = Math.ceil(filteredLeaves.length / pageSize) || 1;
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeaves.slice(start, start + pageSize);
  }, [filteredLeaves, currentPage, pageSize]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, filterStatus, filterLeaveType, filterDept, filterBranch, searchQuery]);

  const getLeaveTypeLabel = (code) => {
    const type = leaveTypes.find(t => t.code === code || t.nameEn === code);
    if (type) return getLocalizedName(type.nameEn, type.nameKh);
    if (code === 'AL' || code === 'Annual Leave') return language === 'kh' ? 'ច្បាប់ប្រចាំឆ្នាំ (AL)' : 'Annual Leave';
    if (code === 'SL' || code === 'Sick Leave') return language === 'kh' ? 'ច្បាប់ឈឺ (SL)' : 'Sick Leave';
    if (code === 'PL' || code === 'Personal Leave') return language === 'kh' ? 'ច្បាប់ផ្ទាល់ខ្លួន (PL)' : 'Personal Leave';
    if (code === 'UL' || code === 'Unpaid Leave') return language === 'kh' ? 'ច្បាប់ឥតប្រាក់ឈ្នួល (UL)' : 'Unpaid Leave';
    return code;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-khmer">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'បានអនុម័ត' : 'Approved'}</span>
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-khmer">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'រង់ចាំ' : 'Pending'}</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-khmer">
            <XCircleIcon className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'បដិសេធ' : 'Rejected'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 font-khmer">
            {status || '-'}
          </span>
        );
    }
  };

  const handleExportExcel = () => {
    if (filteredLeaves.length === 0) {
      alert(language === 'kh' ? 'មិនមានទិន្នន័យច្បាប់សម្រាកសម្រាប់ Export ឡើយ!' : 'No leave records to export!');
      return;
    }

    const todayStr = formatDateDDMMYYYY(new Date());
    const title = `Leave Requests & Summary Report (${todayStr})`;

    let rowsHtml = '';
    filteredLeaves.forEach((item, index) => {
      const emp = item.employee;
      const empName = emp ? (language === 'kh' && emp.nameKh ? `${emp.nameKh} (${emp.nameEn})` : emp.nameEn) : item.employeeName || item.staffId;
      const deptName = emp?.department?.nameEn || '-';
      const posName = emp?.position?.titleEn || '-';
      const sDate = formatDateDDMMYYYY(item.startDate || item.leaveDate);
      const eDate = formatDateDDMMYYYY(item.endDate || item.leaveDate);
      const dateRange = !item.endDate || item.startDate === item.endDate
        ? sDate
        : `${sDate} to ${eDate}`;

      rowsHtml += `
        <tr>
          <td style="text-align:center; padding:6px;">${index + 1}</td>
          <td style="text-align:center; padding:6px; font-weight:bold;">${item.staffId || '-'}</td>
          <td style="padding:6px; font-weight:bold;">${empName}</td>
          <td style="padding:6px;">${deptName}</td>
          <td style="padding:6px;">${posName}</td>
          <td style="text-align:center; padding:6px;">${emp?.branch || '-'}</td>
          <td style="text-align:center; padding:6px; font-weight:bold;">${getLeaveTypeLabel(item.leaveType)}</td>
          <td style="text-align:center; padding:6px;">${dateRange}</td>
          <td style="text-align:center; padding:6px;">${item.durationType || 'Full Day'}</td>
          <td style="text-align:center; padding:6px; font-weight:bold;">${item.amountDays || 1}</td>
          <td style="padding:6px;">${item.reason || '-'}</td>
          <td style="text-align:center; padding:6px; font-weight:bold; color:${item.status === 'Approved' ? '#059669' : item.status === 'Pending' ? '#d97706' : '#e11d48'};">${item.status}</td>
          <td style="padding:6px;">${item.createdBy || '-'}</td>
        </tr>
      `;
    });

    let deptHeadersHtml = '<th>No.</th><th>Department</th><th>Staff Count</th>';
    (departmentStats.typeList || []).forEach(t => {
      deptHeadersHtml += `<th>${t.labelEn}</th>`;
    });
    deptHeadersHtml += '<th>ToTal leave In Department</th><th>Total Requests</th>';

    let deptRowsHtml = '';
    (departmentStats.deptList || []).forEach((dept, index) => {
      deptRowsHtml += `
        <tr>
          <td style="text-align:center; padding:6px;">${index + 1}</td>
          <td style="padding:6px; font-weight:bold;">${dept.displayName}</td>
          <td style="text-align:center; padding:6px;">${dept.employeeCount}</td>
      `;
      (departmentStats.typeList || []).forEach(t => {
        deptRowsHtml += `<td style="text-align:center; padding:6px; font-weight:bold;">${(dept.typeDays[t.code] || 0).toFixed(1)}</td>`;
      });
      deptRowsHtml += `
          <td style="text-align:center; padding:6px; font-weight:bold;">${(dept.totalDays || 0).toFixed(1)}</td>
          <td style="text-align:center; padding:6px; font-weight:bold;">${dept.totalRequests}</td>
        </tr>
      `;
    });

    let deptFooterHtml = `
      <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #000;">
        <td style="text-align: center; padding: 6px;">#</td>
        <td style="padding: 6px; background-color: #86efac; color: #064e3b; font-weight: bold; text-align: center;">Total</td>
        <td style="text-align: center; padding: 6px;">${columnTotals.totalStaff}</td>
    `;
    (departmentStats.typeList || []).forEach(t => {
      deptFooterHtml += `<td style="text-align: center; padding: 6px; font-weight: bold;">${(columnTotals.typeTotals[t.code] || 0).toFixed(1)}</td>`;
    });
    deptFooterHtml += `
        <td style="text-align: center; padding: 6px; font-weight: bold;">${columnTotals.grandTotalDays.toFixed(1)}</td>
        <td style="text-align: center; padding: 6px; font-weight: bold;">${columnTotals.grandTotalRequests}</td>
      </tr>
    `;

    const excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Leave Report</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; }
          .title-row { font-size: 14pt; font-weight: bold; text-align: center; height: 35px; }
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; }
          table.report-table th { border: 1px solid #000000; background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; padding: 6px 10px; font-size: 10pt; }
          table.report-table td { border: 1px solid #000000; font-size: 10pt; }
        </style>
      </head>
      <body>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
          <tr>
            <td colspan="13" class="title-row">${title}</td>
          </tr>
          <tr>
            <td colspan="13" style="text-align:center; font-size:10pt; color:#64748b;">
              Date Range: ${startDate} to ${endDate} | Total Requests: ${stats.totalRequests} | Approved Days: ${stats.totalDaysApproved}
            </td>
          </tr>
        </table>

        <div style="font-size:11pt; font-weight:bold; margin-bottom:6px; color:#1e293b;">1. SUMMARY LEAVE IN DEPARTMENT</div>
        <table class="report-table" style="margin-bottom:20px;">
          <thead>
            <tr>
              ${deptHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${deptRowsHtml}
          </tbody>
          <tfoot>
            ${deptFooterHtml}
          </tfoot>
        </table>

        <div style="font-size:11pt; font-weight:bold; margin-bottom:6px; color:#1e293b;">2. DETAILED LEAVE REQUESTS</div>
        <table class="report-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Staff ID</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Position</th>
              <th>Branch</th>
              <th>Leave Type</th>
              <th>Date / Duration</th>
              <th>Shift Type</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Leave_Report_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl glow-indigo flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-2xl shadow-inner">
            <CalendarIcon className="h-7 w-7 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {language === 'kh' ? 'របាយការណ៍ច្បាប់សម្រាក (Leave Report)' : 'Leave Requests & Analytics Report'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {language === 'kh'
                ? 'តាមដាន ពិនិត្យ និងទាញយករបាយការណ៍សុំច្បាប់តាមដេប៉ាតឺម៉ង់ ប្រភេទច្បាប់ និងស្ថានភាពអនុម័ត'
                : 'Track, review, and export employee leave requests across departments, types, and approval statuses'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredLeaves.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-4 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>{t('printPdf') || 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('fromDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('toDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{t('departments')}</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
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
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{t('branch')} ({t('all')})</option>
              <option value="Phnom Penh HQ" className="bg-slate-900">Phnom Penh HQ</option>
              <option value="Siem Reap Branch" className="bg-slate-900">Siem Reap Branch</option>
              <option value="Battambang Branch" className="bg-slate-900">Battambang Branch</option>
              <option value="Sihanoukville Branch" className="bg-slate-900">Sihanoukville Branch</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/5">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{language === 'kh' ? 'ប្រភេទច្បាប់' : 'Leave Type'}</label>
            <select
              value={filterLeaveType}
              onChange={(e) => setFilterLeaveType(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{language === 'kh' ? 'ប្រភេទច្បាប់ (ទាំងអស់)' : 'Leave Type (All)'}</option>
              {leaveTypes.map((type) => (
                <option key={type.id || type.code} value={type.code} className="bg-slate-900">
                  {getLocalizedName(type.nameEn, type.nameKh)} ({type.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{language === 'kh' ? 'ស្ថានភាព' : 'Status'}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
            >
              <option value="" className="bg-slate-900">{language === 'kh' ? 'ស្ថានភាព (ទាំងអស់)' : 'Status (All)'}</option>
              <option value="Approved" className="bg-slate-900">{language === 'kh' ? 'បានអនុម័ត (Approved)' : 'Approved'}</option>
              <option value="Pending" className="bg-slate-900">{language === 'kh' ? 'រង់ចាំ (Pending)' : 'Pending'}</option>
              <option value="Rejected" className="bg-slate-900">{language === 'kh' ? 'បដិសេធ (Rejected)' : 'Rejected'}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">{language === 'kh' ? 'ស្វែងរកបុគ្គលិក / មូលហេតុ' : 'Search'}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={language === 'kh' ? 'ស្វែងរកតាមឈ្មោះ, ID, មូលហេតុ...' : 'Search by name, ID, reason...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-9 pr-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all font-khmer"
              />
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => { setFilterStatus(''); setCurrentPage(1); }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterStatus === '' ? 'border-indigo-500/80 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50' : 'border-white/5 hover:border-indigo-500/30'
          }`}
        >
          <span className="block text-[11px] text-slate-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'សំណើសរុប' : 'Total Requests'}</span>
          <span className="block text-xl font-bold mt-1 text-white font-mono">{stats.totalRequests}</span>
        </div>
        <div
          onClick={() => { setFilterStatus('Approved'); setCurrentPage(1); }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterStatus === 'Approved' ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' : 'border-white/5 hover:border-emerald-500/30'
          }`}
        >
          <span className="block text-[11px] text-emerald-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'បានអនុម័ត' : 'Approved'}</span>
          <span className="block text-xl font-bold mt-1 text-emerald-400 font-mono">{stats.approved}</span>
        </div>
        <div
          onClick={() => { setFilterStatus('Pending'); setCurrentPage(1); }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterStatus === 'Pending' ? 'border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50' : 'border-white/5 hover:border-amber-500/30'
          }`}
        >
          <span className="block text-[11px] text-amber-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'រង់ចាំពិនិត្យ' : 'Pending'}</span>
          <span className="block text-xl font-bold mt-1 text-amber-400 font-mono">{stats.pending}</span>
        </div>
        <div
          onClick={() => { setFilterStatus('Rejected'); setCurrentPage(1); }}
          className={`glass-card p-4 rounded-2xl border text-center cursor-pointer transition-all ${
            filterStatus === 'Rejected' ? 'border-rose-500/80 bg-rose-500/10 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/50' : 'border-white/5 hover:border-rose-500/30'
          }`}
        >
          <span className="block text-[11px] text-rose-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'បដិសេធ' : 'Rejected'}</span>
          <span className="block text-xl font-bold mt-1 text-rose-400 font-mono">{stats.rejected}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 text-center">
          <span className="block text-[11px] text-purple-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'ថ្ងៃច្បាប់អនុម័តសរុប' : 'Approved Days'}</span>
          <span className="block text-xl font-bold mt-1 text-purple-400 font-mono">{stats.totalDaysApproved} <span className="text-xs font-normal">{language === 'kh' ? 'ថ្ងៃ' : 'days'}</span></span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 text-center">
          <span className="block text-[11px] text-indigo-400 font-semibold uppercase font-khmer">{language === 'kh' ? 'បុគ្គលិកសុំច្បាប់' : 'Staff on Leave'}</span>
          <span className="block text-xl font-bold mt-1 text-indigo-400 font-mono">{stats.uniqueStaff}</span>
        </div>
      </div>

      {/* Analytics Breakdown: Leave Types & Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Type Breakdown */}
        <div className="glass-card p-5 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <h3 className="text-sm font-bold text-white font-khmer">
                {language === 'kh' ? 'ចំណាត់ថ្នាក់តាមប្រភេទច្បាប់ (Leave by Type)' : 'Leave Distribution by Type'}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{typeBreakdown.length} types</span>
          </div>

          <div className="space-y-3">
            {typeBreakdown.map((item, idx) => (
              <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white font-khmer">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-purple-400 font-bold">{item.count} {language === 'kh' ? 'សំណើ' : 'reqs'}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({item.days} days)</span>
                    <span className="text-slate-500 font-mono text-[10px]">[{item.percentage}%]</span>
                  </div>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-500"
                  ></div>
                </div>
              </div>
            ))}
            {typeBreakdown.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6 font-khmer">{language === 'kh' ? 'មិនមានទិន្នន័យ' : 'No records found'}</p>
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="glass-card p-5 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <h3 className="text-sm font-bold text-white font-khmer">
                {language === 'kh' ? 'ចំណាត់ថ្នាក់តាមដេប៉ាតឺម៉ង់ (Leave by Department)' : 'Leave Distribution by Department'}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{deptBreakdown.length} depts</span>
          </div>

          <div className="space-y-3">
            {deptBreakdown.map((item, idx) => (
              <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white font-khmer">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-400 font-bold">{item.count} {language === 'kh' ? 'សំណើ' : 'reqs'}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({item.days} days)</span>
                    <span className="text-slate-500 font-mono text-[10px]">[{item.percentage}%]</span>
                  </div>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full transition-all duration-500"
                  ></div>
                </div>
              </div>
            ))}
            {deptBreakdown.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6 font-khmer">{language === 'kh' ? 'មិនមានទិន្នន័យ' : 'No records found'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Department Metrics Breakdown Table */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <h3 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងស្ថិតិលម្អិតតាមដេប៉ាតឺម៉ង់ (Department Metrics Breakdown Table)' : 'Department Metrics Breakdown Table'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-khmer">
            Total : <span className="text-white font-bold">{departmentStats.deptList?.length || 0}</span> departments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 print:text-xs">
            <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10 print:bg-slate-100">
              <tr>
                <th className="py-3.5 px-4 font-khmer w-12 text-center">NO.</th>
                <th className="py-3.5 px-6 font-khmer">{t('departments')}</th>
                <th className="py-3.5 px-4 font-khmer text-center">{language === 'kh' ? 'ចំនួនបុគ្គលិក' : 'STAFF COUNT'}</th>
                {(departmentStats.typeList || []).map(t => (
                  <th key={t.code} className="py-3.5 px-4 font-khmer text-center font-bold">
                    {language === 'kh' ? t.labelKh : t.labelEn}
                  </th>
                ))}
                <th className="py-3.5 px-4 font-khmer text-center font-bold">{language === 'kh' ? 'សរុបច្បាប់ (TOTAL LEAVE)' : 'TOTAL LEAVE IN DEPT'}</th>
                <th className="py-3.5 px-4 font-khmer text-center font-bold">{language === 'kh' ? 'សំណើសរុប' : 'TOTAL REQUESTS'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(departmentStats.deptList || []).map((dept, index) => (
                <tr key={dept.id || index} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">{index + 1}</td>
                  <td className="py-3.5 px-6 font-bold text-white font-khmer">{dept.displayName}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-white">{dept.employeeCount}</td>
                  {(departmentStats.typeList || []).map(t => (
                    <td
                      key={t.code}
                      className="py-3.5 px-4 text-center font-mono font-semibold text-white"
                      title={`${dept.typeCounts[t.code] || 0} requests`}
                    >
                      {(dept.typeDays[t.code] || 0).toFixed(1)}
                    </td>
                  ))}
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                    {(dept.totalDays || 0).toFixed(1)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                    {dept.totalRequests}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total Row matching user's summary requirement */}
            <tfoot className="bg-slate-950/90 border-t-2 border-indigo-500/40 font-bold print:bg-slate-200">
              <tr>
                <td className="py-4 px-4 text-center font-mono text-slate-500">#</td>
                <td className="py-4 px-6">
                  <span className="inline-block px-3 py-1 rounded bg-[#86efac] text-emerald-950 font-black text-xs tracking-wider uppercase border border-emerald-400 shadow-sm font-mono">
                    Total
                  </span>
                </td>
                <td className="py-4 px-4 text-center font-mono text-white font-bold text-sm">
                  {columnTotals.totalStaff}
                </td>
                {(departmentStats.typeList || []).map(t => (
                  <td key={`total-${t.code}`} className="py-4 px-4 text-center font-mono font-bold text-sm text-white">
                    {(columnTotals.typeTotals[t.code] || 0).toFixed(1)}
                  </td>
                ))}
                <td className="py-4 px-4 text-center font-mono font-bold text-white text-sm">
                  {columnTotals.grandTotalDays.toFixed(1)}
                </td>
                <td className="py-4 px-4 text-center font-mono font-bold text-white text-sm">
                  {columnTotals.grandTotalRequests}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detailed Leaves Table - Designed identically to Attendance Report */}
      <div className="glass-card rounded-2xl overflow-hidden print-card">
        <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <h3 className="text-sm font-bold text-white font-khmer">
              {language === 'kh' ? 'តារាងសំណើសុំច្បាប់លម្អិត (Detailed Leave Requests)' : 'Detailed Leave Requests'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono font-khmer">
            Total : <span className="text-white font-bold">{filteredLeaves.length}</span> records
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
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{language === 'kh' ? 'ប្រភេទច្បាប់' : 'Leave Type'}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{language === 'kh' ? 'រយៈពេល / វេន' : 'Duration'}</th>
                  <th className="py-4 px-6 font-khmer text-center whitespace-nowrap">{language === 'kh' ? 'ចំនួនថ្ងៃ' : 'Days'}</th>
                  <th className="py-4 px-6 font-khmer">{language === 'kh' ? 'មូលហេតុ' : 'Reason'}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t('status')}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{language === 'kh' ? 'អ្នកស្នើសុំ / បង្កើត' : 'Created By'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                {paginatedLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-khmer">
                      {language === 'kh' ? 'មិនមានទិន្នន័យច្បាប់សម្រាកត្រូវនឹងលក្ខខណ្ឌចម្រោះនេះឡើយ' : 'No leave requests match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  paginatedLeaves.map((item, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const emp = item.employee || {};
                    const photo = getEmployeePhoto(emp);
                    const nameEn = emp.nameEn || item.employeeName || item.staffId || '';
                    const nameKh = emp.nameKh || '';
                    const empName = getLocalizedName(nameEn, nameKh) || nameEn || item.staffId;
                    const deptName = emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '';
                    const posTitle = emp.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '';
                    const branchName = emp.branch || '';

                    const sDate = formatDateDDMMYYYY(item.startDate || item.leaveDate);
                    const eDate = formatDateDDMMYYYY(item.endDate || item.leaveDate);
                    const dateStr = !item.endDate || item.startDate === item.endDate
                      ? sDate
                      : `${sDate} ~ ${eDate}`;

                    return (
                      <tr key={item.id || index} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                        {/* No. */}
                        <td className="py-4 px-4 text-center font-bold text-slate-400 whitespace-nowrap font-mono">
                          {rowNumber}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-6 font-semibold text-white whitespace-nowrap font-mono">
                          {dateStr}
                        </td>

                        {/* Employee Card matching Attendance Report */}
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
                                {(nameEn || item.staffId || 'E').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white whitespace-nowrap">
                                {empName}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">
                                ID: <span className="text-indigo-400 font-semibold">{item.staffId}</span>
                                {emp.role ? ` • ${emp.role}` : ''}
                              </p>
                              {(deptName || posTitle || branchName) && (
                                <p className="text-[11px] text-indigo-400 truncate">
                                  {[deptName, posTitle, branchName].filter(Boolean).join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="py-4 px-6 whitespace-nowrap font-mono">
                          <span className="font-semibold text-purple-300">
                            {getLeaveTypeLabel(item.leaveType)}
                          </span>
                        </td>

                        {/* Duration / Shift */}
                        <td className="py-4 px-6 whitespace-nowrap font-mono text-xs text-slate-300">
                          {item.durationType || 'Full Day'}
                        </td>

                        {/* Days */}
                        <td className="py-4 px-6 text-center font-mono font-bold text-white whitespace-nowrap">
                          {item.amountDays || 1}
                        </td>

                        {/* Reason */}
                        <td className="py-4 px-6 text-xs text-slate-300 font-khmer max-w-[220px] truncate" title={item.reason}>
                          {item.reason || '-'}
                        </td>

                        {/* Status badges matching Attendance Report */}
                        <td className="py-4 px-6 space-y-1 whitespace-nowrap">
                          {item.status === 'Approved' && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                              {language === 'kh' ? 'បានអនុម័ត' : 'Approved'}
                            </span>
                          )}
                          {item.status === 'Pending' && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20 font-khmer">
                              {language === 'kh' ? 'រង់ចាំ' : 'Pending'}
                            </span>
                          )}
                          {item.status === 'Rejected' && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20 font-khmer">
                              {language === 'kh' ? 'បដិសេធ' : 'Rejected'}
                            </span>
                          )}
                          {item.status !== 'Approved' && item.status !== 'Pending' && item.status !== 'Rejected' && (
                            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20 font-khmer">
                              {item.status || '-'}
                            </span>
                          )}
                        </td>

                        {/* Created By */}
                        <td className="py-4 px-6 whitespace-nowrap text-xs text-slate-400 font-khmer">
                          {item.createdBy || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls identical to Attendance Report */}
        {!loading && filteredLeaves.length > 0 && (
          <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs no-print">
            <div className="text-slate-400 font-khmer">
              Total : <span className="font-bold text-white font-mono">{filteredLeaves.length}</span> records
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

              {getPaginationItems().map((pageItem, idx) => {
                if (pageItem === '...') {
                  return (
                    <span key={`dots-${idx}`} className="h-8 min-w-[32px] flex items-center justify-center text-slate-500 font-mono">
                      ...
                    </span>
                  );
                }
                const isCurrent = pageItem === currentPage;
                return (
                  <button
                    key={`page-${pageItem}`}
                    type="button"
                    onClick={() => setCurrentPage(pageItem)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'bg-slate-900/60 border border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {pageItem}
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

export default LeaveReport;
