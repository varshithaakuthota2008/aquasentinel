import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

import Navbar         from './components/Navbar';
import Sidebar        from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

import LoginPage               from './pages/LoginPage';
import RegisterPage            from './pages/RegisterPage';
import PendingApprovalPage     from './pages/PendingApprovalPage';
import CitizenDashboard        from './pages/CitizenDashboard';
import WaterAnalystDashboard   from './pages/WaterAnalystDashboard';
import FieldVerifierDashboard  from './pages/FieldVerifierDashboard';
import AdminDashboard          from './pages/AdminDashboard';
import AdminUserManagement     from './pages/AdminUserManagement';
import AdminApprovals          from './pages/AdminApprovals';
import AdminStations           from './pages/AdminStations';
import AdminAuditLogs          from './pages/AdminAuditLogs';
import AdminSettings           from './pages/AdminSettings';
import ReportFormPage          from './pages/ReportFormPage';
import ReportDetailPage        from './pages/ReportDetailPage';
import LocationsPage           from './pages/LocationsPage';
import AnalyticsPage           from './pages/AnalyticsPage';
import InspectionFormPage      from './pages/InspectionFormPage';
import InspectionAssignmentPage from './pages/InspectionAssignmentPage';
import FieldObservationPage    from './pages/FieldObservationPage';
import AssignmentReviewPage    from './pages/AssignmentReviewPage';
import CSVImportPage           from './pages/CSVImportPage';
import MonitoringPage          from './pages/MonitoringPage';
import ProfilePage             from './pages/ProfilePage';
import NotFoundPage            from './pages/NotFoundPage';

import './style.css';

function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  if (user.account_status === 'pending') return <Navigate to="/pending" replace />;
  if (user.role === 'admin')           return <Navigate to="/admin"    replace />;
  if (user.role === 'water_authority') return <Navigate to="/authority" replace />;
  if (user.role === 'field_inspector') return <Navigate to="/inspector" replace />;
  return <Navigate to="/citizen" replace />;
}

function AppShell() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return (
    <div className="app-shell">
      <div className="main-wrap"><LoadingSpinner message="Starting AquaSentinel…" /></div>
    </div>
  );

  const isAuth = !!user && user.account_status !== 'pending';

  return (
    <div className="app-shell">
      <Navbar onMenuToggle={() => setMenuOpen(o => !o)} menuOpen={menuOpen} />
      <div className={`app-body ${isAuth ? 'with-sidebar' : ''}`}>
        {isAuth && <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />}
        <main className={isAuth ? 'main-content' : 'main-wrap'}>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pending"  element={<PendingApprovalPage />} />

            {/* Redirect */}
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/"          element={<DashboardRedirect />} />

            {/* Citizen */}
            <Route path="/citizen" element={
              <ProtectedRoute roles={['citizen']}>
                <CitizenDashboard />
              </ProtectedRoute>
            } />

            {/* Water Analyst */}
            <Route path="/authority" element={
              <ProtectedRoute roles={['water_authority']}>
                <WaterAnalystDashboard />
              </ProtectedRoute>
            } />
            <Route path="/analyst" element={
              <ProtectedRoute roles={['water_authority']}>
                <WaterAnalystDashboard />
              </ProtectedRoute>
            } />
            <Route path="/analyst/assign" element={
              <ProtectedRoute roles={['water_authority', 'admin']}>
                <InspectionAssignmentPage />
              </ProtectedRoute>
            } />
            <Route path="/analyst/assignments/:id" element={
              <ProtectedRoute roles={['water_authority', 'admin']}>
                <AssignmentReviewPage />
              </ProtectedRoute>
            } />

            {/* Field Verifier */}
            <Route path="/inspector" element={
              <ProtectedRoute roles={['field_inspector']}>
                <FieldVerifierDashboard />
              </ProtectedRoute>
            } />
            <Route path="/verifier/observations/new" element={
              <ProtectedRoute roles={['field_inspector']}>
                <FieldObservationPage />
              </ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/admin"           element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users"     element={<ProtectedRoute roles={['admin']}><AdminUserManagement /></ProtectedRoute>} />
            <Route path="/admin/approvals" element={<ProtectedRoute roles={['admin']}><AdminApprovals /></ProtectedRoute>} />
            <Route path="/admin/stations"  element={<ProtectedRoute roles={['admin']}><AdminStations /></ProtectedRoute>} />
            <Route path="/admin/audit"     element={<ProtectedRoute roles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
            <Route path="/admin/settings"  element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />

            {/* Shared — data & monitoring */}
            <Route path="/import" element={
              <ProtectedRoute roles={['water_authority', 'admin']}>
                <CSVImportPage />
              </ProtectedRoute>
            } />
            <Route path="/monitoring" element={
              <ProtectedRoute roles={['water_authority', 'admin']}>
                <MonitoringPage />
              </ProtectedRoute>
            } />

            {/* Reports */}
            <Route path="/reports/new" element={
              <ProtectedRoute roles={['citizen', 'field_inspector']}>
                <ReportFormPage />
              </ProtectedRoute>
            } />
            <Route path="/reports/:id" element={
              <ProtectedRoute>
                <ReportDetailPage />
              </ProtectedRoute>
            } />

            {/* Locations (public) */}
            <Route path="/locations" element={<LocationsPage />} />

            {/* Analytics */}
            <Route path="/analytics" element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            } />

            {/* Inspections */}
            <Route path="/inspections/new" element={
              <ProtectedRoute roles={['field_inspector']}>
                <InspectionFormPage />
              </ProtectedRoute>
            } />

            {/* Profile */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
      <footer>
        © {new Date().getFullYear()} AquaSentinel · Team Garuda (TS-015)
        <span>Built for SDG 6 · Clean Water and Sanitation</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
