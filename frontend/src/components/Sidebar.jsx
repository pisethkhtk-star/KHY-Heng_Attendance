import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  HomeIcon,
  ClockIcon,
  BoltIcon,
  CalendarIcon,
  DocumentChartBarIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  MapPinIcon,
  UserGroupIcon,
  GlobeAltIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { LOGO_TEXT } from '../utils/constants';
import appIcon from '../assets/app_icon.png';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, hasPermission } = useAuth();
  const { t, locale, language } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({ Approvals: true, Attendance: true, Leave: true, Setup: true, WebManage: true, Reports: true });

  const menuItems = [
    {
      path: "/",
      name: t("dashboard"),
      icon: HomeIcon,
    },
    {
      key: "Setup",
      name: t("setupGroup"),
      icon: UserGroupIcon,
      subItems: [
        {
          path: "/employees",
          name: t("employees"),
          resource: "employees",
        },
        {
          path: "/positions",
          name: t("positions"),
          resource: "positions",
        },
        {
          path: "/departments",
          name: t("departments"),
          resource: "departments",
        },
        {
          path: "/work-hours",
          name: t("workHours"),
          resource: "work_hours",
        },
      ]
    },
    {
      key: "Attendance",
      name: t("attendance"),
      icon: ClockIcon,
      subItems: [
        {
          path: "/attendance",
          name: t("allAttendanceLogs"),
          resource: "attendance",
        },
        {
          path: "/attendance-early-in",
          name: t("earlyArrivals"),
          resource: "attendance_early_in",
        },
        {
          path: "/attendance-late",
          name: t("lateArrivals"),
          resource: "attendance_late",
        },
        {
          path: "/attendance-early-out",
          name: t("earlyDepartures"),
          resource: "attendance_early_out",
        },
        {
          path: "/attendance-incomplete",
          name: t("incompleteShifts"),
          resource: "attendance_incomplete",
        },
      ]
    },
    {
      path: "/overtime",
      name: t("overtime"),
      icon: BoltIcon,
      resource: "overtime",
    },
    {
      key: "Leave",
      name: t("leaveGroup"),
      icon: CalendarIcon,
      subItems: [
        {
          path: "/leaves",
          name: t("requestItem"),
          resource: "leaves",
        },
        {
          path: "/leave-types",
          name: t("types"),
          resource: "leave_types",
        },
        {
          path: "/leave-allowances",
          name: t("allowances"),
          resource: "leave_allowances",
        },
      ]
    },
    {
      key: "Approvals",
      name: t("approvalGroup") || "Approvals",
      icon: CheckBadgeIcon,
      subItems: [
        {
          path: "/approval-manage/leave",
          name: t("leaveApprovers") || (isKhmer ? "កំណត់អ្នកអនុម័តច្បាប់" : "Leave Approvers"),
          resource: "leave_approvals",
        },
        {
          path: "/approval-manage/overtime",
          name: t("overtimeApprovers") || (isKhmer ? "កំណត់អ្នកអនុម័តថែមម៉ោង" : "Overtime Approvers"),
          resource: "leave_approvals",
        },
        {
          path: "/approval-manage/checkin",
          name: t("checkinApprovers") || (isKhmer ? "កំណត់សិទ្ធិចុះវត្តមានជំនួស" : "Check-in on Behalf"),
          resource: "leave_approvals",
        },
      ]
    },
    {
      key: "Reports",
      name: t("reports"),
      icon: DocumentChartBarIcon,
      resource: "reports",
      subItems: [
        {
          path: "/reports",
          name: t("attendanceReportMenu") || "Attendance Report",
          resource: "reports",
        },
        {
          path: "/reports/attendance-slip",
          name: t("attendanceSlipReport") || (isKhmer ? "ប័ណ្ណវត្តមាន (Attendance Slip)" : "Attendance Slip"),
          resource: "reports",
        },
        {
          path: "/reports/leave",
          name: t("leaveReport") || "Leave Report",
          resource: "leave_reports",
        },
      ]
    },
    {
      path: "/kiosk",
      name: t("facescan"),
      icon: ComputerDesktopIcon,
      resource: ["facescan", "qrscan"],
    },
    {
      path: "/kiosk-settings",
      name: t("branchSetting"),
      icon: MapPinIcon,
      resource: "kiosk_settings",
    },
    {
      key: "WebManage",
      name: t("webManage") || "Web Manage",
      icon: GlobeAltIcon,
      subItems: [
        {
          path: "/telegram-settings",
          name: t("telegramGroup"),
          resource: "telegram_settings",
        },
      ]
    },
    {
      path: "/permissions",
      name: "Permissions",
      icon: ShieldCheckIcon,
      resource: "permissions",
    },
  ];

  // Filter items based on permissions
  const filteredItems = menuItems.map(item => {
    if (item.subItems) {
      const allowedSubItems = item.subItems.filter(sub => {
        if (!sub.resource) return true;
        if (Array.isArray(sub.resource)) {
          return sub.resource.some(res => hasPermission(res));
        }
        return hasPermission(sub.resource);
      });
      if (allowedSubItems.length > 0) {
        return { ...item, subItems: allowedSubItems };
      }
      return null;
    }
    if (item.adminOnly) return user?.role === 'Admin' ? item : null;
    if (!item.resource) return item;
    if (Array.isArray(item.resource)) {
      return item.resource.some(res => hasPermission(res)) ? item : null;
    }
    return hasPermission(item.resource) ? item : null;
  }).filter(Boolean);

  const currentPath = location.pathname;

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 w-64 bg-[var(--bg-card)] border-r border-[var(--border-card)] text-[var(--text-secondary)] transition-transform duration-300 transform md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } no-print`}
    >
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-[var(--border-card)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-3">
          <img src={appIcon} alt="HR Chomnan Logo" className="h-10 w-10 rounded-xl object-cover shadow-md shadow-[var(--brand-blue)]/10" />
          <span className="text-xl font-black text-[var(--text-primary)] tracking-wide font-sans">
            {LOGO_TEXT}<span className="text-[var(--brand-blue)]">.</span>
          </span>
        </div>
        <button
          onClick={toggleSidebar}
          className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <span className="sr-only">Close sidebar</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="mt-6 space-y-1 overflow-y-auto max-h-[calc(100vh-6rem)]">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          
          if (item.subItems) {
            const isMenuOpen = openMenus[item.key];
            const isChildActive = item.subItems.some(sub => currentPath === sub.path);
            
            return (
              <div key={item.key} className="space-y-1">
                <button
                  onClick={() => setOpenMenus(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`w-full flex items-center justify-between px-6 py-3.5 text-sm font-medium transition-all duration-200 text-left outline-none border-none bg-transparent cursor-pointer ${
                    isChildActive 
                      ? 'text-[var(--brand-blue)] font-bold' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 flex-shrink-0 ${isChildActive ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`} />
                    <span className="font-khmer">{item.name}</span>
                  </div>
                  <svg
                    className={`h-4 w-4 transform transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isMenuOpen && (
                  <div className="pl-6 space-y-1 border-l border-[var(--border-card)] ml-9 mr-4">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        end
                        onClick={() => isOpen && toggleSidebar()}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'text-[var(--brand-blue)] font-bold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)]'
                          }`
                        }
                      >
                        <span className="font-khmer">{sub.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => isOpen && toggleSidebar()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-200 relative border-none bg-transparent ${
                  isActive
                    ? 'text-[var(--brand-blue)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-lg bg-[var(--brand-blue)]" />
                  )}
                  <Icon className={`h-6 w-6 flex-shrink-0 transition-colors ${isActive ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`} />
                  <span className="font-khmer">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
