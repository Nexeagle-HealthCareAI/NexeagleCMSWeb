import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Layout from './components/Layout';
import Dashboard from './features/dashboard/pages/Dashboard';
import Login from './features/login/pages/Login';
import ChangePassword from './features/login/pages/ChangePassword';
import HospitalDetails from './features/dashboard/pages/HospitalDetails';
import OnboardedHospitals from './features/dashboard/pages/OnboardedHospitals';
import SettingsPage from './features/settings/pages/Settings';
import ApplicationHealth from './features/dashboard/pages/ApplicationHealth';
import LiveSupport from './features/support/pages/LiveSupport';
import SubscriptionsPage from './features/subscriptions/SubscriptionsPage';
import ManagePlansPage from './features/subscriptions/ManagePlansPage';
import HospitalSubscriptionsPage from './features/subscriptions/HospitalSubscriptionsPage';
import PartnersPage from './features/partners/pages/PartnersPage';
import PartnerDashboard from './features/partners/pages/PartnerDashboard';
import RadAiCost from './features/ai-cost/pages/RadAiCost';
import UsersAccess from './features/admin/pages/UsersAccess';
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
    // Access token lives in memory only. On page reload the persisted store still
    // knows the user was authenticated but the token is gone. Try a silent refresh
    // using the HttpOnly refresh cookie before rendering any protected routes.
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
            <Route path="onboarded-hospitals" element={<OnboardedHospitals />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="hospital/:id" element={<RequirePermission perm="hospital-details.view"><HospitalDetails /></RequirePermission>} />
            <Route path="manage-plans" element={<RequirePermission perm="subscriptions.view"><ManagePlansPage /></RequirePermission>} />
            <Route path="subscriptions" element={<RequirePermission perm="subscriptions.view"><SubscriptionsPage /></RequirePermission>} />
            <Route path="hospital-subscriptions" element={<RequirePermission perm="subscriptions.view"><HospitalSubscriptionsPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission perm="settings.view"><SettingsPage /></RequirePermission>} />
            <Route path="application-health" element={<RequirePermission perm="application-health.view"><ApplicationHealth /></RequirePermission>} />
            <Route path="radai-cost" element={<RequirePermission perm="radai-cost.view"><RadAiCost /></RequirePermission>} />
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
