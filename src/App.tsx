import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Layout from './components/Layout';
import Dashboard from './features/dashboard/pages/Dashboard';
import TodayPage from './features/today/TodayPage';
import { ApprovalsPage, PlansPage, ReferralCodesPage, InsightsPage, SymptomRouterPage, FreeTierPage } from './features/shell/MenuPages';
import Login from './features/login/pages/Login';
import ChangePassword from './features/login/pages/ChangePassword';
import HospitalDetails from './features/dashboard/pages/HospitalDetails';
import OnboardedHospitals from './features/dashboard/pages/OnboardedHospitals';
import RadCentersPage from './features/radCenters/pages/RadCentersPage';
import DoctorsPage from './features/doctors/pages/DoctorsPage';
import SettingsPage from './features/settings/pages/Settings';
import LiveSupport from './features/support/pages/LiveSupport';
import PartnersPage from './features/partners/pages/PartnersPage';
import DataMigrationPage from './features/dataMigration/pages/DataMigrationPage';
import NewMigrationWizard from './features/dataMigration/pages/NewMigrationWizard';
import PartnerDashboard from './features/partners/pages/PartnerDashboard';
import UsersAccess from './features/admin/pages/UsersAccess';
import MarketingPage from './features/marketing/pages/MarketingPage';
import VitaAgentsPage from './features/vitaAgents/pages/VitaAgentsPage';
import { VitaLayout, VitaOverviewPage, VitaRunsPage, VitaCasesPage, VitaCoveragePage, VitaSchedulesPage, VitaLearningPage, VitaSettingsPage, VitaKnownFindingsPage, VitaAgentKitPage, VitaAgentTryPage, VitaAiAgentsPage } from './features/vitaAgents';
import HealthWikiPage from './features/healthWiki/pages/HealthWikiPage';
import ArticleEditorPage from './features/healthWiki/pages/ArticleEditorPage';
import ContributorsPage from './features/healthWiki/pages/ContributorsPage';
import TopicRequestsPage from './features/healthWiki/pages/TopicRequestsPage';
import TopicRequestDetailPage from './features/healthWiki/pages/TopicRequestDetailPage';
import { canUseHealthWiki } from './features/healthWiki/access';
import RequirePermission from './components/RequirePermission';
import EmergencyPage from './features/emergency/EmergencyPage';
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

// Health Wiki is gated by `health-wiki.manage` (or the local mock flag while the backend is not wired).
const RequireHealthWiki = ({ children }: { children: React.ReactElement }) => {
  const permissions = useAuthStore((s) => s.permissions);
  return canUseHealthWiki(permissions) ? children : <Navigate to="/no-access" replace />;
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
            {/* Today shows each section only to people allowed to open its page. */}
            <Route index element={<TodayPage />} />
            <Route path="growth" element={<RequirePermission perm="dashboard.view"><Dashboard /></RequirePermission>} />
            <Route path="onboarded-hospitals" element={<RequirePermission perm="onboarded-hospitals.view"><OnboardedHospitals /></RequirePermission>} />
            <Route path="rad-centers" element={<RequirePermission perm="dashboard.view"><RadCentersPage /></RequirePermission>} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="partners" element={<RequirePermission perm="partners.manage"><PartnersPage /></RequirePermission>} />
            <Route path="data-migration" element={<RequirePermission perm="data-migration.manage"><DataMigrationPage /></RequirePermission>} />
            <Route path="data-migration/new" element={<RequirePermission perm="data-migration.manage"><NewMigrationWizard /></RequirePermission>} />
            <Route path="data-migration/:id" element={<RequirePermission perm="data-migration.manage"><NewMigrationWizard /></RequirePermission>} />
            <Route path="hospital/:id" element={<RequirePermission perm="hospital-details.view"><HospitalDetails /></RequirePermission>} />
            {/* Money: Manage Subscription's four tabs are now three pages (1HMS and 1Rad approvals share one). */}
            <Route path="approvals" element={<RequirePermission perm="subscriptions.view"><ApprovalsPage /></RequirePermission>} />
            <Route path="plans" element={<RequirePermission perm="subscriptions.view"><PlansPage /></RequirePermission>} />
            <Route path="referral-codes" element={<RequirePermission perm="subscriptions.view"><ReferralCodesPage /></RequirePermission>} />
            <Route path="subscriptions" element={<Navigate to="/approvals" replace />} />
            <Route path="manage-plans" element={<Navigate to="/plans" replace />} />
            {/* Pages that used to be tabs inside Doctor Dekho and Onboarded Hospitals. */}
            <Route path="insights" element={<InsightsPage />} />
            <Route path="symptom-router" element={<SymptomRouterPage />} />
            <Route path="free-tier" element={<RequirePermission perm="onboarded-hospitals.view"><FreeTierPage /></RequirePermission>} />
            <Route path="emergency" element={<RequirePermission perm="emergency.manage"><EmergencyPage /></RequirePermission>} />
            <Route path="health-wiki" element={<RequireHealthWiki><HealthWikiPage /></RequireHealthWiki>} />
            <Route path="health-wiki/contributors" element={<RequireHealthWiki><ContributorsPage /></RequireHealthWiki>} />
            <Route path="health-wiki/topics" element={<RequireHealthWiki><TopicRequestsPage /></RequireHealthWiki>} />
            <Route path="health-wiki/topics/:id" element={<RequireHealthWiki><TopicRequestDetailPage /></RequireHealthWiki>} />
            <Route path="health-wiki/new" element={<RequireHealthWiki><ArticleEditorPage key="new" /></RequireHealthWiki>} />
            <Route path="health-wiki/:slug" element={<RequireHealthWiki><ArticleEditorPage key="edit" /></RequireHealthWiki>} />
            {/* Growth: Marketing's tabs are three menu items. */}
            <Route path="leads" element={<RequirePermission perm="marketing.view"><MarketingPage key="leads" section="leads" /></RequirePermission>} />
            <Route path="social" element={<RequirePermission perm="marketing.view"><MarketingPage key="social" section="social" /></RequirePermission>} />
            <Route path="demo-logins" element={<RequirePermission perm="marketing.view"><MarketingPage key="demo" section="demo" /></RequirePermission>} />
            <Route path="marketing" element={<Navigate to="/leads" replace />} />
            <Route path="vita-agents" element={<RequirePermission perm="dashboard.view"><VitaAgentsPage /></RequirePermission>} />
            <Route path="vita" element={<RequirePermission perm="vita.view"><VitaLayout /></RequirePermission>}>
              <Route index element={<VitaOverviewPage />} />
              <Route path="runs" element={<VitaRunsPage />} />
              <Route path="cases" element={<VitaCasesPage />} />
              <Route path="coverage" element={<VitaCoveragePage />} />
              <Route path="known" element={<VitaKnownFindingsPage />} />
              <Route path="agents" element={<VitaAgentKitPage />} />
              <Route path="agents/:name" element={<VitaAgentTryPage />} />
              <Route path="ai" element={<VitaAiAgentsPage />} />
              <Route path="schedules" element={<VitaSchedulesPage />} />
              <Route path="learning" element={<VitaLearningPage />} />
              <Route path="settings" element={<VitaSettingsPage />} />
            </Route>
            <Route path="settings" element={<RequirePermission perm="settings.view"><SettingsPage /></RequirePermission>} />
            <Route path="support" element={<RequirePermission perm="live-support.view"><LiveSupport key="live" view="live" /></RequirePermission>} />
            <Route path="support/history" element={<RequirePermission perm="live-support.view"><LiveSupport key="history" view="history" /></RequirePermission>} />
            <Route path="users" element={<RequirePermission perm="user-management.view"><UsersAccess /></RequirePermission>} />
            <Route path="no-access" element={<NoAccess />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
