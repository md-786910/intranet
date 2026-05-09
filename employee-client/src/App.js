import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import EmployeeLayout from './components/layout/EmployeeLayout';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import HomePage from './pages/home/HomePage';
import NewsListPage from './pages/news/NewsListPage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import PeoplePage from './pages/people/PeoplePage';
import DocumentsPage from './pages/documents/DocumentsPage';
import CategoryDetailPage from './pages/documents/CategoryDetailPage';
import PoliciesPage from './pages/policies/PoliciesPage';
import OrgChartPage from './pages/org-chart/OrgChartPage';
import SettingsPage from './pages/settings/SettingsPage';

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
                  <SocketProvider>
                    <EmployeeLayout />
                  </SocketProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/news" element={<NewsListPage />} />
              <Route path="/news/:id" element={<NewsDetailPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/categories/:id" element={<CategoryDetailPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/org-chart" element={<OrgChartPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
