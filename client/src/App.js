import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import OrganisationPage from './pages/organisation/OrganisationPage';
import UsersListPage from './pages/users/UsersListPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UserEditPage from './pages/users/UserEditPage';
import RolesListPage from './pages/roles/RolesListPage';
import RoleCreatePage from './pages/roles/RoleCreatePage';
import RoleEditPage from './pages/roles/RoleEditPage';
import NewsListPage from './pages/news/NewsListPage';
import NewsCreatePage from './pages/news/NewsCreatePage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import NewsEditPage from './pages/news/NewsEditPage';
import DocumentsListPage from './pages/documents/DocumentsListPage';
import DocumentCreatePage from './pages/documents/DocumentCreatePage';
import DocumentDetailPage from './pages/documents/DocumentDetailPage';
import PushListPage from './pages/push/PushListPage';
import PushCreatePage from './pages/push/PushCreatePage';
import PushDetailPage from './pages/push/PushDetailPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <ToastProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/organisation" element={<OrganisationPage />} />

                {/* Users */}
                <Route path="/users" element={<UsersListPage />} />
                <Route path="/users/create" element={<UserCreatePage />} />
                <Route path="/users/:id" element={<UserDetailPage />} />
                <Route path="/users/:id/edit" element={<UserEditPage />} />

                {/* Roles */}
                <Route path="/roles" element={<RolesListPage />} />
                <Route path="/roles/create" element={<RoleCreatePage />} />
                <Route path="/roles/:id" element={<RoleEditPage />} />

                {/* News */}
                <Route path="/news" element={<NewsListPage />} />
                <Route path="/news/create" element={<NewsCreatePage />} />
                <Route path="/news/:id" element={<NewsDetailPage />} />
                <Route path="/news/:id/edit" element={<NewsEditPage />} />

                {/* Documents */}
                <Route path="/documents" element={<DocumentsListPage />} />
                <Route path="/documents/create" element={<DocumentCreatePage />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />

                {/* Push */}
                <Route path="/push" element={<PushListPage />} />
                <Route path="/push/create" element={<PushCreatePage />} />
                <Route path="/push/:id" element={<PushDetailPage />} />

                {/* Analytics */}
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
