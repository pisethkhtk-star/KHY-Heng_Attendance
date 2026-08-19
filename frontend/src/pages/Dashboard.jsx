import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import {
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { formatTime12Hour } from '../utils/dateUtils';

const Dashboard = () => {
  const { user } = useAuth();
  const { t, getLocalizedName } = useLanguage();

  // Statistics State
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    earlyLeaveToday: 0,
    onLeaveToday: 0,
  });

  // Time logging details
  const [liveTime, setLiveTime] = useState('');
  const [liveDate, setLiveDate] = useState('');

  // Daily log state
  const [todayLogs, setTodayLogs] = useState([]);
  const [personalTodayLog, setPersonalTodayLog] = useState(null);

  const [_loading, setLoading] = useState(true);

  // Update live clock
  useEffect(() => {
    const updateTime = () => {
      const options = { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
      const dateOptions = { timeZone: 'Asia/Phnom_Penh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-US', options));
      setLiveDate(now.toLocaleDateString('en-US', dateOptions));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch stats & today's logs if admin, HR, or manager
      if (user.role !== 'Employee') {
        const statsRes = await api.get('/attendances/stats');
        setStats(statsRes.data);

        const logsRes = await api.get('/attendances/today');
        setTodayLogs(logsRes.data);
      }

      // Fetch personal today log for the logged-in employee
      const personalHistory = await api.get(`/attendances/history?staffId=${user.staffId}&startDate=${new Date().toISOString().split('T')[0]}`);
      if (personalHistory.data && personalHistory.data.length > 0) {
        setPersonalTodayLog(personalHistory.data[0]);
      } else {
        setPersonalTodayLog(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);



  return (
    <div className="space-y-[30px]">
      {/* Top Banner with Clock & Greetings */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-[25px] shadow-sm gap-4 relative overflow-hidden glow-indigo">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-blue)]/5 rounded-full filter blur-[80px] pointer-events-none"></div>
        <div className="z-10">
          <h2 className="text-2xl font-bold font-sans">
            {t("welcome")}, {getLocalizedName(user.nameEn, user.nameKh)}!
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-1">{liveDate}</p>
        </div>
        <div className="z-10 bg-[var(--bg-app)] px-6 py-3 rounded-2xl border border-[var(--border-card)] text-center font-mono">
          <span className="text-3xl font-bold tracking-widest text-[var(--brand-blue)]">{liveTime}</span>
          <span className="block text-[10px] uppercase text-[var(--text-secondary)] font-semibold tracking-widest mt-1">Phnom Penh (GMT+7)</span>
        </div>
      </div>

      {/* Stats Cards (For Admins/HR/Managers) */}
      {user.role !== 'Employee' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-[30px]">
          <div className="glass-card flex items-center gap-4">
            <div className="p-4 bg-[#FFE0B2]/60 dark:bg-[#FFE0B2]/10 rounded-full text-amber-500">
              <UsersIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium font-khmer">{t("totalEmployees")}</p>
              <h3 className="text-xl font-bold mt-1 text-[var(--text-primary)]">{stats.totalEmployees}</h3>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4">
            <div className="p-4 bg-[#E0F2F1]/60 dark:bg-[#E0F2F1]/10 rounded-full text-teal-500">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium font-khmer">{t("presentToday")}</p>
              <h3 className="text-xl font-bold mt-1 text-teal-500">{stats.presentToday}</h3>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4">
            <div className="p-4 bg-[#FFF9C4]/60 dark:bg-[#FFF9C4]/10 rounded-full text-yellow-600">
              <ClockIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium font-khmer">{t("lateToday")}</p>
              <h3 className="text-xl font-bold mt-1 text-yellow-600">{stats.lateToday}</h3>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4">
            <div className="p-4 bg-[#FFEBEE]/60 dark:bg-[#FFEBEE]/10 rounded-full text-rose-500">
              <ExclamationCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium font-khmer">{t("earlyLeaveToday")}</p>
              <h3 className="text-xl font-bold mt-1 text-rose-500">{stats.earlyLeaveToday}</h3>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4 col-span-2 lg:col-span-1">
            <div className="p-4 bg-[#E1F5FE]/60 dark:bg-[#E1F5FE]/10 rounded-full text-sky-500">
              <CalendarDaysIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium font-khmer">{t("onLeaveToday")}</p>
              <h3 className="text-xl font-bold mt-1 text-sky-500">{stats.onLeaveToday}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Row: My Cards & Recent Check-ins */}


      {/* Main Console & Check-in / Check-out actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[30px]">
        {/* Attendance Console */}
        <div className="lg:col-span-2 glass-card flex flex-col justify-between glow-indigo">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-card)]">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 font-khmer text-lg">
                <ClockIcon className="h-5 w-5 text-[var(--brand-blue)]" />
                Today's Attendance Status
              </h3>
            </div>

            {/* Shift profile display */}
            <div className="mt-6 grid grid-cols-2 gap-6 p-5 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px] text-xs">
              <div>
                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">{t("shift1")}</p>
                <p className="text-[var(--text-primary)] font-bold text-sm mt-1">
                  {user.shift1Start} - {user.shift1End}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">{t("shift2")}</p>
                <p className="text-[var(--text-primary)] font-bold text-sm mt-1">
                  {user.shift2Start} - {user.shift2End}
                </p>
              </div>
            </div>

            {/* Logs Today state */}
            <div className="mt-6 grid grid-cols-4 gap-4 text-center text-xs">
              <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px]">
                <p className="text-[var(--text-secondary)] font-semibold font-khmer">{t("checkin1")}</p>
                <p className={`font-bold text-sm mt-2 ${personalTodayLog?.checkin1 ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                  {personalTodayLog?.checkin1 ? formatTime12Hour(personalTodayLog.checkin1) : t("notLogged")}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px]">
                <p className="text-[var(--text-secondary)] font-semibold font-khmer">{t("checkout1")}</p>
                <p className={`font-bold text-sm mt-2 ${personalTodayLog?.checkout1 ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                  {personalTodayLog?.checkout1 ? formatTime12Hour(personalTodayLog.checkout1) : t("notLogged")}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px]">
                <p className="text-[var(--text-secondary)] font-semibold font-khmer">{t("checkin2")}</p>
                <p className={`font-bold text-sm mt-2 ${personalTodayLog?.checkin2 ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                  {personalTodayLog?.checkin2 ? formatTime12Hour(personalTodayLog.checkin2) : t("notLogged")}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px]">
                <p className="text-[var(--text-secondary)] font-semibold font-khmer">{t("checkout2")}</p>
                <p className={`font-bold text-sm mt-2 ${personalTodayLog?.checkout2 ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                  {personalTodayLog?.checkout2 ? formatTime12Hour(personalTodayLog.checkout2) : t("notLogged")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Indicators Card / Personal Status */}
        <div className="glass-card flex flex-col justify-between glow-indigo">
          <div>
            <h3 className="font-bold text-[var(--text-primary)] pb-4 border-b border-[var(--border-card)] font-khmer text-lg">
              Daily Indicators
            </h3>

            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] font-khmer">ស្ថានភាពចុះវត្តមានយឺត (Late Status)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Calculated by checking system</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${personalTodayLog?.isLate
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}
                >
                  {personalTodayLog?.isLate ? t("late") : t("normal")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] font-khmer">ស្ថានភាពចេញមុន (Early Leave)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Calculated by checkout shifts</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${personalTodayLog?.isEarlyLeave
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}
                >
                  {personalTodayLog?.isEarlyLeave ? t("earlyLeave") : t("normal")}
                </span>
              </div>

              {personalTodayLog?.note && (
                <div className="p-4 bg-[var(--bg-app)] rounded-xl border border-[var(--border-card)]">
                  <p className="text-xs font-bold text-[var(--brand-blue)] font-khmer">កំណត់សម្គាល់ថ្ងៃនេះ (Today's note):</p>
                  <p className="text-xs text-[var(--text-primary)] mt-1">{personalTodayLog.note}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 p-4 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-[15px] text-center">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Logged Account Profile</span>
            <span className="text-sm font-bold text-[var(--brand-blue)] block mt-1">{user.staffId}</span>
            <span className="text-xs text-[var(--text-secondary)] block mt-0.5">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Live Table (For HR/Admin/Managers to view today's check-ins) */}
      {user.role !== 'Employee' && (
        <div className="glass-card overflow-hidden">
          <div className="pb-6 border-b border-[var(--border-card)]">
            <h3 className="font-bold text-[var(--text-primary)] font-khmer text-lg">
              {t("attendanceSummary")}
            </h3>
          </div>
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-left text-sm text-[var(--text-primary)] glass-table">
              <thead>
                <tr>
                  <th className="py-4 px-6 font-khmer">{t("staffId")}</th>
                  <th className="py-4 px-6 font-khmer">{t("employees")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkin1")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkout1")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkin2")}</th>
                  <th className="py-4 px-6 font-khmer">{t("checkout2")}</th>
                  <th className="py-4 px-6 font-khmer">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-card)]">
                {todayLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-secondary)] font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  todayLogs.map((log) => (
                    <tr key={log.id} className="transition-colors">
                      <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">{log.employee.staffId}</td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {getLocalizedName(log.employee.nameEn, log.employee.nameKh)}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {getLocalizedName(log.employee.department.nameEn, log.employee.department.nameKh)} • {getLocalizedName(log.employee.position.titleEn, log.employee.position.titleKh)}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[var(--text-primary)]">{formatTime12Hour(log.checkin1)}</td>
                      <td className="py-4 px-6 text-[var(--text-primary)]">{formatTime12Hour(log.checkout1)}</td>
                      <td className="py-4 px-6 text-[var(--text-primary)]">{formatTime12Hour(log.checkin2)}</td>
                      <td className="py-4 px-6 text-[var(--text-primary)]">{formatTime12Hour(log.checkout2)}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {log.isLate && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 ring-1 ring-amber-500/20 font-khmer">
                              {t("late")}
                            </span>
                          )}
                          {log.isEarlyLeave && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 ring-1 ring-rose-500/20 font-khmer">
                              {t("earlyLeave")}
                            </span>
                          )}
                          {!log.isLate && !log.isEarlyLeave && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 ring-1 ring-emerald-500/20 font-khmer">
                              {t("normal")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
