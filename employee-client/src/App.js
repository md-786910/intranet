import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import EmployeeLayout from './components/layout/EmployeeLayout';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import WorkspaceHomePage from './pages/workspace/WorkspaceHomePage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/invitations/:token" element={<InvitationAcceptPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/workspace" element={<WorkspaceHomePage />} />
              <Route path="/" element={<Navigate to="/workspace" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/workspace" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
