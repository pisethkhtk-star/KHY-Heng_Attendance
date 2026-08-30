import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Bars3Icon,
  ArrowLeftOnRectangleIcon,
  SunIcon,
  MoonIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { locale, setLocale, t, getLocalizedName } = useLanguage();
  const location = useLocation();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

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
    if (cleanPath === 'approval-manage') return t('approvalManage') || 'Approval Manage';
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
