import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Layout from './components/Layout';
import Dashboard from './features/dashboard/pages/Dashboard';
import Login from './features/login/pages/Login';
import ChangePassword from './features/login/pages/ChangePassword';
import HospitalDetails from './features/dashboard/pages/HospitalDetails';
import OnboardedHospitals from './features/dashboard/pages/OnboardedHospitals';
import DoctorsPage from './features/doctors/pages/DoctorsPage';
import SettingsPage from './features/settings/pages/Settings';
import LiveSupport from './features/support/pages/LiveSupport';
import SubscriptionManagementPage from './features/subscriptions/SubscriptionManagementPage';
import PartnersPage from './features/partners/pages/PartnersPage';
import PartnerDashboard from './features/partners/pages/PartnerDashboard';
import UsersAccess from './features/admin/pages/UsersAccess';
import MarketingPage from './features/marketing/pages/MarketingPage';
import RequirePermission from './components/RequirePermission';
import NoAccess from './components/NoAccess';
import ErrorBoundary from './components/ErrorBoundary';
import InactivityTracker from './components/InactivityTracker';

// Auth gate: requires login, and forces a password change when flagged.
const ProtectedRoute = ({ children, allowWhilePasswordChange = false }: { children: React.ReactElement; allowWhilePasswordChange?: boolean }) => {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword && !allowWhilePasswordChange) return <Navigate to="/change-password" replace />;
  return children;
};

function App() {
  const { isAuthenticated, token, silentRefresh } = useAuthStore();
  const [booting, setBooting] = React.useState(true);

  React.useEffect(() => {
    // The access token IS persisted (useAuthStore's zustand `persist` includes it in
    // partialize, rehydrated from localStorage before this effect runs), so this branch
    // is a defensive fallback for the rarer case where isAuthenticated rehydrated but
    // token didn't (partial localStorage failure/tampering) rather than the normal-reload
    // path. Try a silent refresh using the HttpOnly refresh cookie before rendering any
    // protected routes in that case.
    if (isAuthenticated && !token) {
      silentRefresh().finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (booting) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <InactivityTracker />
      <ErrorBoundary>
        <Routes>
          <Route path="/partner-dashboard/:token" element={<PartnerDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={
            <ProtectedRoute allowWhilePasswordChange>
              <ChangePassword />
            </ProtectedRoute>
          } />

          <Route path="/users-access" element={<RequirePermission perm="dashboard.view"><Dashboard /></RequirePermission>} />

          {/* Protected app shell */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<RequirePermission perm="dashboard.view"><Dashboard /></RequirePermission>} />
            <Route path="onboarded-hospitals" element={<RequirePermission perm="onboarded-hospitals.view"><OnboardedHospitals /></RequirePermission>} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="partners" element={<RequirePermission perm="partners.manage"><PartnersPage /></RequirePermission>} />
            <Route path="hospital/:id" element={<RequirePermission perm="hospital-details.view"><HospitalDetails /></RequirePermission>} />
            <Route path="manage-plans" element={<Navigate to="/subscriptions" replace />} />
            <Route path="subscriptions" element={<RequirePermission perm="subscriptions.view"><SubscriptionManagementPage /></RequirePermission>} />
            <Route path="marketing" element={<RequirePermission perm="marketing.view"><MarketingPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission perm="settings.view"><SettingsPage /></RequirePermission>} />
            <Route path="support" element={<RequirePermission perm="live-support.view"><LiveSupport /></RequirePermission>} />
            <Route path="users" element={<RequirePermission perm="user-management.view"><UsersAccess /></RequirePermission>} />
            <Route path="no-access" element={<NoAccess />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
