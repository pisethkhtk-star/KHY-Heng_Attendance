import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { stopAllCameraStreams } from './utils/cameraManager';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Positions from './pages/Positions';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import AttendanceEarlyIn from './pages/AttendanceEarlyIn';
import AttendanceLate from './pages/AttendanceLate';
import AttendanceEarlyOut from './pages/AttendanceEarlyOut';
import AttendanceIncomplete from './pages/AttendanceIncomplete';
import Leaves from './pages/Leaves';
import Overtime from './pages/Overtime';
import Reports from './pages/Reports';
import LeaveReport from './pages/LeaveReport';
import AttendanceSlip from './pages/AttendanceSlip';
import Kiosk from './pages/Kiosk';
import KioskSettings from './pages/KioskSettings';
import Permissions from './pages/Permissions';
import LeaveTypes from './pages/LeaveTypes'; // verified
import LeaveAllowances from './pages/LeaveAllowances'; // verified
import WorkHours from './pages/WorkHours'; // verified
import ApprovalManage from './pages/ApprovalManage';
import TelegramSettings from './pages/TelegramSettings';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Automatically shut down any active camera/mic streams whenever navigating to another page
  useEffect(() => {
    stopAllCameraStreams();
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex relative overflow-hidden">
      {/* Mobile Overlay - closes sidebar when clicking outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Collapsible Left Sidebar */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 h-screen transition-all duration-300 relative z-10 overflow-hidden">
        {/* Top Navbar */}
        <Navbar toggleSidebar={toggleSidebar} />

        {/* Scrollable Panel */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-h-0">
          <div className="max-w-7xl mx-auto pb-16">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Application Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard */}
              <Route index element={<Dashboard />} />

              {/* Departments */}
              <Route
                path="departments"
                element={
                  <ProtectedRoute resource="departments">
                    <Departments />
                  </ProtectedRoute>
                }
              />

              {/* Positions */}
              <Route
                path="positions"
                element={
                  <ProtectedRoute resource="positions">
                    <Positions />
                  </ProtectedRoute>
                }
              />

              {/* Employees */}
              <Route
                path="employees"
                element={
                  <ProtectedRoute resource="employees">
                    <Employees />
                  </ProtectedRoute>
                }
              />

              {/* Attendance Log & Sub-pages */}
              <Route path="attendance" element={<Attendance />} />
              <Route path="attendance-early-in" element={<AttendanceEarlyIn />} />
              <Route path="attendance-late" element={<AttendanceLate />} />
              <Route path="attendance-early-out" element={<AttendanceEarlyOut />} />
              <Route path="attendance-incomplete" element={<AttendanceIncomplete />} />

              {/* Overtime Request & Approvals (All authenticated users) */}
              <Route path="overtime" element={<Overtime />} />

              {/* Leaves Request & Approvals (All authenticated users) */}
              <Route path="leaves" element={<Leaves />} />

              {/* Reports */}
              <Route
                path="reports"
                element={
                  <ProtectedRoute resource="reports">
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports/attendance"
                element={
                  <ProtectedRoute resource="reports">
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports/leave"
                element={
                  <ProtectedRoute resource="reports">
                    <LeaveReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports/attendance-slip"
                element={
                  <ProtectedRoute resource="reports">
                    <AttendanceSlip />
                  </ProtectedRoute>
                }
              />

              {/* Kiosk Mode */}
              <Route
                path="kiosk"
                element={
                  <ProtectedRoute resource={["facescan", "qrscan"]}>
                    <Kiosk />
                  </ProtectedRoute>
                }
              />

              {/* Kiosk Geofencing Settings (Permission-guarded) */}
              <Route
                path="kiosk-settings"
                element={
                  <ProtectedRoute resource="kiosk_settings">
                    <KioskSettings />
                  </ProtectedRoute>
                }
              />

              {/* Leave Types Configuration (Permission-guarded) */}
              <Route
                path="leave-types"
                element={
                  <ProtectedRoute resource="leave_types">
                    <LeaveTypes />
                  </ProtectedRoute>
                }
              />

              {/* Leave Allowances Configuration (Permission-guarded) */}
              <Route
                path="leave-allowances"
                element={
                  <ProtectedRoute resource="leave_allowances">
                    <LeaveAllowances />
                  </ProtectedRoute>
                }
              />

              {/* Approval Management Routes */}
              <Route
                path="approval-manage"
                element={<Navigate to="/approval-manage/leave" replace />}
              />
              <Route
                path="approval-manage/leave"
                element={
                  <ProtectedRoute resource="leave_approvals">
                    <ApprovalManage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="approval-manage/overtime"
                element={
                  <ProtectedRoute resource="leave_approvals">
                    <ApprovalManage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="approval-manage/checkin"
                element={
                  <ProtectedRoute resource="leave_approvals">
                    <ApprovalManage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="approvals"
                element={<Navigate to="/approval-manage/leave" replace />}
              />

              {/* Company Work Hours Settings (Permission-guarded) */}
              <Route
                path="work-hours"
                element={
                  <ProtectedRoute resource="work_hours">
                    <WorkHours />
                  </ProtectedRoute>
                }
              />

              {/* Telegram Group Notifications Settings */}
              <Route
                path="telegram-settings"
                element={
                  <ProtectedRoute roles={['Admin', 'HR']}>
                    <TelegramSettings />
                  </ProtectedRoute>
                }
              />

              {/* Permissions (Admin only) */}
              <Route
                path="permissions"
                element={
                  <ProtectedRoute roles={['Admin']}>
                    <Permissions />
                  </ProtectedRoute>
                }
              />

              {/* Fallback routing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
