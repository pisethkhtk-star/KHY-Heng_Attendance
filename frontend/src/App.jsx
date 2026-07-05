import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

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
import Leaves from './pages/Leaves';
import Reports from './pages/Reports';
import Kiosk from './pages/Kiosk';
import KioskSettings from './pages/KioskSettings';
import Permissions from './pages/Permissions';
import LeaveTypes from './pages/LeaveTypes'; // verified
import LeaveAllowances from './pages/LeaveAllowances'; // verified
import WorkHours from './pages/WorkHours'; // verified
import ApprovalManage from './pages/ApprovalManage';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex relative overflow-hidden">
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
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all duration-300 relative z-10">
        {/* Top Navbar */}
        <Navbar toggleSidebar={toggleSidebar} />

        {/* Scrollable Panel */}
        <main className="flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
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

              {/* Attendance Log (All authenticated users) */}
              <Route path="attendance" element={<Attendance />} />

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

              {/* Leave Approval Management (Permission-guarded) */}
              <Route
                path="approval-manage"
                element={
                  <ProtectedRoute resource="leave_approvals">
                    <ApprovalManage />
                  </ProtectedRoute>
                }
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
