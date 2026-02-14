import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Layout from './components/Layout';
import Dashboard from './features/dashboard/pages/Dashboard';
import Login from './features/login/pages/Login';
import HospitalDetails from './features/dashboard/pages/HospitalDetails';
import OnboardedHospitals from './features/dashboard/pages/OnboardedHospitals';
import SettingsPage from './features/settings/pages/Settings';
import ApplicationHealth from './features/dashboard/pages/ApplicationHealth';
import ErrorBoundary from './components/ErrorBoundary';

// Simple Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="onboarded-hospitals" element={<OnboardedHospitals />} />
            <Route path="hospital/:id" element={<HospitalDetails />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="application-health" element={<ApplicationHealth />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
