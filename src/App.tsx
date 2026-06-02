import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { auth } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Invoices from './pages/Invoices';
import Examinations from './pages/Examinations';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Settings from './pages/Settings';

import { RolePermissions } from './types';

function ProtectedRoute({ children, permission }: { children: React.ReactNode, permission?: keyof RolePermissions }) {
  const { user, profile, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    // If user is authenticated but profile doesn't exist, something is wrong
    // (e.g. registration failed to save user data).
    // Sign out to allow user to try again.
    setTimeout(() => auth.signOut(), 100);
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (user && profile) return <Navigate to="/" replace />;
  return <>{children}</>;
}

import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { ClinicSettings } from './types';

function ThemeLoader() {
  React.useEffect(() => {
    async function loadTheme() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'clinic'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data() as ClinicSettings;
          if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (e) {
        console.error("Failed to load theme:", e);
      }
    }
    loadTheme();
  }, []);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeLoader />
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute permission="viewDashboard">
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute permission="managePatients">
                <Layout><Patients /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute permission="manageAppointments">
                <Layout><Appointments /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute permission="viewFinances">
                <Layout><Invoices /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/examinations"
            element={
              <ProtectedRoute permission="viewMedicalRecords">
                <Layout><Examinations /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute permission="viewReports">
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute permission="manageSettings">
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            }
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
