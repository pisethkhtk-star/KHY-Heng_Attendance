import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Bars3Icon,
  ArrowLeftOnRectangleIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import notificationService from '../services/NotificationService';

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { locale, language, setLocale, t, getLocalizedName } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';
  const location = useLocation();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const popoverRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const list = await notificationService.getNotifications();
      if (Array.isArray(list)) {
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.isRead).length);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowNotifPopover(false);
      }
    };
    if (showNotifPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifPopover]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleClearAll = async () => {
    try {
      await notificationService.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (_) {}
    }
    setShowNotifPopover(false);
    if (notif.type?.toLowerCase().includes('leave')) {
      navigate('/leaves');
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleLanguageToggle = () => {
    setLocale(locale === 'kh' ? 'en' : 'kh');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('dashboard') || 'Overview';
    const cleanPath = path.substring(1);
    if (cleanPath === 'employees') return t('employees') || 'Employees';
    if (cleanPath === 'positions') return t('positions') || 'Positions';
    if (cleanPath === 'departments') return t('departments') || 'Departments';
    if (cleanPath === 'attendance') return t('allAttendanceLogs') || 'All Attendance Logs';
    if (cleanPath === 'attendance-early-in') return t('earlyArrivals') || 'Early In';
    if (cleanPath === 'attendance-late') return t('lateArrivals') || 'Late';
    if (cleanPath === 'attendance-early-out') return t('earlyDepartures') || 'Early Out';
    if (cleanPath === 'attendance-incomplete') return t('incompleteShifts') || 'Incomplete Shifts';
    if (cleanPath === 'leaves') return t('leaves') || 'Leaves';
    if (cleanPath === 'overtime') return t('overtime') || 'Overtime';
    if (cleanPath === 'reports' || cleanPath === 'reports/attendance') return t('attendanceReportMenu') || 'Attendance Report';
    if (cleanPath === 'reports/leave') return t('leaveReport') || 'Leave Report';
    if (cleanPath === 'kiosk') return t('facescan') || 'Kiosk';
    if (cleanPath === 'kiosk-settings') return t('branchSetting') || 'Kiosk Settings';
    if (cleanPath === 'work-hours') return t('workHours') || 'Work Hours';
    if (cleanPath === 'leave-types') return t('types') || 'Leave Types';
    if (cleanPath === 'leave-allowances') return t('allowances') || 'Leave Allowances';
    if (cleanPath === 'approvals') return t('approvalGroup') || 'Approvals';
    if (cleanPath === 'approval-manage/leave') return t('leaveApprovers') || (isKhmer ? 'កំណត់អ្នកអនុម័តច្បាប់' : 'Leave Approver Rules');
    if (cleanPath === 'approval-manage/overtime') return t('overtimeApprovers') || (isKhmer ? 'កំណត់អ្នកអនុម័តថែមម៉ោង' : 'Overtime Approver Rules');
    if (cleanPath === 'approval-manage/checkin') return t('checkinApprovers') || (isKhmer ? 'កំណត់សិទ្ធិចុះវត្តមានជំនួស' : 'Check-in on Behalf');
    if (cleanPath === 'approval-manage') return t('approvalManage') || 'Approval Manage';
    if (cleanPath === 'push-notifications') return isKhmer ? 'ផ្ញើការជូនដំណឹង (Push Notifications)' : 'Push Notifications';
    if (cleanPath === 'permissions') return 'Permissions';
    return 'Overview';
  };


  return (
    <header className="sticky top-0 z-20 flex h-20 w-full items-center justify-between border-b border-[var(--border-card)] bg-[var(--bg-card)] px-6 no-print shadow-sm text-[var(--text-primary)]">
      {/* Left side: Hamburger (Mobile) and Dynamic Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] md:hidden cursor-pointer"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-sans">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right side: Search, Actions, Avatar */}
      <div className="flex items-center gap-4">
        {/* Search Input (Pill shape) - hidden on small mobile */}
        {/*         
        <div className="relative hidden md:block w-64">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search for something"
            className="pl-12 pr-4 py-2 w-full text-sm bg-[var(--bg-app)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] rounded-full outline-none focus:border-[var(--brand-blue)] transition-all"
          />
        </div> */}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Notification Bell Dropdown */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowNotifPopover((prev) => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-app)] hover:bg-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all outline-none"
              title={isKhmer ? 'ការជូនដំណឹង' : 'Notifications'}
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Popover */}
            {showNotifPopover && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-2xl z-50 overflow-hidden text-[var(--text-primary)] transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-card)] px-4 py-3 bg-[var(--bg-app)]/50">
                  <div className="flex items-center gap-2">
                    <BellIcon className="h-5 w-5 text-indigo-500" />
                    <span className="font-semibold text-sm">
                      {isKhmer ? 'ការជូនដំណឹង' : 'Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {unreadCount} {isKhmer ? 'ថ្មី' : 'new'}
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-indigo-500 hover:text-indigo-600 cursor-pointer px-2 py-1 rounded hover:bg-indigo-500/10 transition-all"
                        title="Mark all as read"
                      >
                        {isKhmer ? 'អានទាំងអស់' : 'Mark all read'}
                      </button>
                      <button
                        onClick={handleClearAll}
                        className="p-1 text-[var(--text-secondary)] hover:text-rose-500 rounded hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Clear all"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-card)]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[var(--text-secondary)]">
                      <BellIcon className="h-10 w-10 stroke-1 mb-2 opacity-40" />
                      <p className="text-xs">
                        {isKhmer ? 'គ្មានការជូនដំណឹងថ្មីទេ' : 'No notifications'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const typeLower = (n.type || '').toLowerCase();
                      const isApproved = typeLower.includes('approved');
                      const isRejected = typeLower.includes('rejected');
                      const isDeleted = typeLower.includes('deleted') || typeLower.includes('cancelled');
                      const isRequest = typeLower.includes('request');

                      let statusBadge = (
                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                      );
                      let iconEl = <ClockIcon className="h-5 w-5 text-indigo-500" />;
                      if (isApproved) {
                        iconEl = <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
                      } else if (isRejected) {
                        iconEl = <XCircleIcon className="h-5 w-5 text-rose-500" />;
                      } else if (isDeleted) {
                        iconEl = <TrashIcon className="h-5 w-5 text-amber-500" />;
                      } else if (isRequest) {
                        iconEl = <BellIcon className="h-5 w-5 text-blue-500" />;
                      }

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`flex items-start gap-3 p-3.5 transition-all cursor-pointer hover:bg-[var(--bg-app)] ${
                            !n.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0">{iconEl}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-xs font-semibold truncate ${!n.isRead ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-relaxed">
                              {n.message}
                            </p>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-70 block mt-1">
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString(isKhmer ? 'km-KH' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Theme Toggler (Circular badge) */}
          <button
            onClick={handleThemeToggle}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-app)] hover:bg-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all outline-none"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5 text-amber-400" />
            ) : (
              <MoonIcon className="h-5 w-5 text-[var(--brand-blue)]" />
            )}
          </button>

          {/* Language Toggler */}
          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--bg-app)] hover:bg-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer font-semibold text-xs border-none"
          >
            <span className="text-base">{locale === 'kh' ? '🇰🇭' : '🇺🇸'}</span>
            <span className="font-mono text-[10px] tracking-wider">{locale === 'kh' ? 'KH' : 'EN'}</span>
          </button>
        </div>

        <div className="h-6 w-px bg-[var(--border-card)]"></div>

        {/* User profile & logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              {(user.photoUrl || (Array.isArray(user.faceData) ? user.faceData[0]?.photoUrl : user.faceData?.photoUrl)) ? (
                <img
                  src={user.photoUrl || (Array.isArray(user.faceData) ? user.faceData[0]?.photoUrl : user.faceData?.photoUrl)}
                  alt={user.nameEn}
                  className="h-10 w-10 rounded-full object-cover border border-[var(--border-card)] shadow-inner"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0">
                  {user.nameEn?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">
                  {getLocalizedName(user.nameEn, user.nameKh)}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                  {user.role}
                </p>
              </div>
            </div>
          )}

          {/* Log Out Button */}
          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer border-none"
            title={t("logout")}
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
