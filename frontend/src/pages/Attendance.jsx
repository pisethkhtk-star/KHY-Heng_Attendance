import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { MagnifyingGlassIcon, PencilIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import { formatTime12Hour } from '../utils/dateUtils';

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

const Attendance = () => {
  const { user, hasPermission } = useAuth();
  const { t, getLocalizedName } = useLanguage();

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

  // Filters & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    // Default to start of current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, _setFilterBranch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (user.role === 'Employee') {
        query += `&staffId=${user.staffId}`;
      } else {
        if (search && search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
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

  const handleExportCSV = () => {
    if (logs.length === 0) return;

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

    const rows = logs.map(log => [
      log.employee.staffId,
      log.employee.nameEn,
      log.employee.nameKh,
      log.employee.department.nameEn,
      new Date(log.attendanceDate).toLocaleDateString(),
      formatTime12Hour(log.checkin1).replace('-', ''),
      formatTime12Hour(log.checkout1).replace('-', ''),
      formatTime12Hour(log.checkin2).replace('-', ''),
      formatTime12Hour(log.checkout2).replace('-', ''),
      log.isLate ? 'YES' : 'NO',
      log.isEarlyLeave ? 'YES' : 'NO',
      log.note || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Log_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchMetadata = async () => {
    try {
      if (user.role !== 'Employee') {
        const response = await api.get('/departments');
        setDepartments(response.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchLogs();
  }, [startDate, endDate, search, filterDept, filterBranch]);

  const displayLogs = logs.filter(log => {
    // Hide record if all checkin/checkout times are null or empty
    const hasAnyTime = Boolean(
      (log.checkin1 && log.checkin1 !== '-' && log.checkin1 !== '--:--') ||
      (log.checkout1 && log.checkout1 !== '-' && log.checkout1 !== '--:--') ||
      (log.checkin2 && log.checkin2 !== '-' && log.checkin2 !== '--:--') ||
      (log.checkout2 && log.checkout2 !== '-' && log.checkout2 !== '--:--')
    );
    if (!hasAnyTime) return false;

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
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>Export Excel</span>
          </button>

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
        {user.role !== 'Employee' ? (
          <>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">Search Staff ID / Employee</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. EMP-001 or Name..."
                  className="pl-9 w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
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
            🔍 កំពុងបង្ហាញកំណត់ត្រាវត្តមានសម្រាប់គណនីរបស់អ្នកផ្ទាល់ ({user.staffId})
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 border-collapse border border-slate-200 dark:border-white/10">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase">
                <tr>
                  <th className="py-3 px-3 font-khmer whitespace-nowrap text-center border border-slate-200 dark:border-white/10">#</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("leaveDate")}</th>
                  {user.role !== 'Employee' && <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("staffId")}</th>}
                  {user.role !== 'Employee' && <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("employees")}</th>}
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("checkin1")}</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("checkout1")}</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("checkin2")}</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("checkout2")}</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("status")}</th>
                  <th className="py-3 px-4 font-khmer whitespace-nowrap border border-slate-200 dark:border-white/10">{t("description")}</th>
                  {(hasPermission('edit_attendance') || hasPermission('delete_attendance')) && (
                    <th className="py-3 px-4 font-khmer text-right whitespace-nowrap border border-slate-200 dark:border-white/10">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={user.role === 'Employee' ? 8 : ((hasPermission('edit_attendance') || hasPermission('delete_attendance')) ? 11 : 10)} className="py-6 text-center text-slate-500 font-khmer border border-slate-200 dark:border-white/10">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-3 font-mono text-center text-slate-400 font-bold whitespace-nowrap border border-slate-200 dark:border-white/10">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap border border-slate-200 dark:border-white/10">
                          {log.attendanceDate ? new Date(log.attendanceDate).toLocaleDateString() : '-'}
                        </td>
                        {user.role !== 'Employee' && (
                          <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap border border-slate-200 dark:border-white/10">
                            {log.employee?.staffId || log.staffId || '-'}
                          </td>
                        )}
                        {user.role !== 'Employee' && (
                          <td className="py-3.5 px-4 whitespace-nowrap min-w-[180px] border border-slate-200 dark:border-white/10">
                            <div>
                              <p className="font-semibold text-white whitespace-nowrap">
                                {getLocalizedName(log.employee?.nameEn, log.employee?.nameKh) || log.staffId || '-'}
                              </p>
                              <p className="text-xs text-slate-400 whitespace-nowrap">
                                {getLocalizedName(log.employee?.department?.nameEn, log.employee?.department?.nameKh) || '-'}
                              </p>
                            </div>
                          </td>
                        )}
                        <td className="py-3.5 px-4 whitespace-nowrap border border-slate-200 dark:border-white/10">{formatTime12Hour(log.checkin1)}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap border border-slate-200 dark:border-white/10">{formatTime12Hour(log.checkout1)}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap border border-slate-200 dark:border-white/10">{formatTime12Hour(log.checkin2)}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap border border-slate-200 dark:border-white/10">{formatTime12Hour(log.checkout2)}</td>
                        <td className="py-3.5 px-4 space-y-1 whitespace-nowrap border border-slate-200 dark:border-white/10">
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
                          {!log.isLate && !log.isEarlyLeave && (log.checkin1 || log.checkin2 || log.checkout1 || log.checkout2) && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20 font-khmer">
                              {t("normal")}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs italic text-slate-400 border border-slate-200 dark:border-white/10">{log.note || '-'}</td>
                        {(hasPermission('edit_attendance') || hasPermission('delete_attendance')) && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPermission('edit_attendance') && (
                                <button
                                  onClick={() => handleOpenEditModal(log)}
                                  className="inline-flex p-2 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-xl text-indigo-400 transition-colors cursor-pointer"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                              )}
                              {hasPermission('delete_attendance') && (
                                <button
                                  onClick={() => handleDelete(log.id)}
                                  className="inline-flex p-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-xl text-rose-400 transition-colors cursor-pointer"
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
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCurrent
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
                        {new Date(selectedLog.attendanceDate).toLocaleDateString()}
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
    </div>
  );
};

export default Attendance;
