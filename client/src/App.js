import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganisationProvider } from './contexts/OrganisationContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { PermissionContext } from './contexts/PermissionContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import NotFoundState from './components/common/NotFoundState';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import AdminLayout from './components/layout/AdminLayout';
import { SocketProvider } from './contexts/SocketContext';
import { ChatUnreadProvider } from './contexts/ChatUnreadContext';
import { AppBrandingProvider } from './contexts/AppBrandingContext';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';

// Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ContentDashboardPage from './pages/dashboard/ContentDashboardPage';
import ChatPage from './pages/chat/ChatPage';
import OrganisationPage from './pages/organisation/OrganisationPage';
import UsersListPage from './pages/users/UsersListPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UserEditPage from './pages/users/UserEditPage';
import EmployeesListPage from './pages/employees/EmployeesListPage';
import EmployeeCreatePage from './pages/employees/EmployeeCreatePage';
import EmployeeDetailPage from './pages/employees/EmployeeDetailPage';
import EmployeeEditPage from './pages/employees/EmployeeEditPage';
import JobTitlesPage from './pages/job-titles/JobTitlesPage';
import RolesListPage from './pages/roles/RolesListPage';
import RoleCreatePage from './pages/roles/RoleCreatePage';
import RoleEditPage from './pages/roles/RoleEditPage';
import NewsListPage from './pages/news/NewsListPage';
import NewsCreatePage from './pages/news/NewsCreatePage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import NewsEditPage from './pages/news/NewsEditPage';
import AnnouncementsListPage from './pages/announcements/AnnouncementsListPage';
import AnnouncementCreatePage from './pages/announcements/AnnouncementCreatePage';
import AnnouncementDetailPage from './pages/announcements/AnnouncementDetailPage';
import AnnouncementEditPage from './pages/announcements/AnnouncementEditPage';
import DocumentsListPage from './pages/documents/DocumentsListPage';
import DocumentCreatePage from './pages/documents/DocumentCreatePage';
import DocumentDetailPage from './pages/documents/DocumentDetailPage';
import DocumentEditPage from './pages/documents/DocumentEditPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import MediaGalleryPage from './pages/media/MediaGalleryPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import ActivityLogPage from './pages/activity/ActivityLogPage';
import QuickLinksPage from './pages/quick-links/QuickLinksPage';
import ActiveDirectoryPage from './pages/active-directory/ActiveDirectoryPage';
import ActiveDirectoryUserDetailPage from './pages/active-directory/ActiveDirectoryUserDetailPage';
import SettingsPage from './pages/settings/SettingsPage';

const EMPLOYEE_APP_URL = process.env.REACT_APP_EMPLOYEE_APP_URL || 'https://employee.brightnow.online';

function HomeRedirect() {
  const { hasPermission } = useContext(PermissionContext);
  const { isLoading, isAuthenticated } = useAuth();

  // Wait for auth bootstrap to finish before making any routing decision.
  // Without this guard, permissions are empty on every page refresh and the
  // user is immediately bounced to the employee portal.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Not authenticated — send to login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Admin-only permissions — stay in admin panel
  if (hasPermission('ADMIN', 'VIEW_ANALYTICS')) return <Navigate to="/dashboard" replace />;
  if (hasPermission('ADMIN', 'MANAGE_USERS')) return <Navigate to="/users" replace />;
  if (hasPermission('ADMIN', 'MANAGE_ROLES')) return <Navigate to="/roles" replace />;
  if (hasPermission('ADMIN', 'MANAGE_OFFICE_LOCATIONS')) return <Navigate to="/organisation" replace />;
  // Content managers — dedicated content dashboard
  if (hasPermission('NEWS', 'EDIT') || hasPermission('NEWS', 'CREATE')
    || hasPermission('DOCUMENTS', 'EDIT') || hasPermission('DOCUMENTS', 'CREATE')) {
    return <Navigate to="/content-dashboard" replace />;
  }
  // No admin permissions — send to employee portal
  window.location.replace(EMPLOYEE_APP_URL);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganisationProvider>
          <PermissionProvider>
            <ToastProvider>
              <ErrorBoundary homeTo="/dashboard" homeLabel="Back to dashboard">
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/invitations/:token" element={<InvitationAcceptPage />} />

              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppBrandingProvider>
                      <SocketProvider>
                        <ChatUnreadProvider>
                          <AdminLayout />
                        </ChatUnreadProvider>
                      </SocketProvider>
                    </AppBrandingProvider>
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/content-dashboard" element={<ContentDashboardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/organisation" element={<OrganisationPage />} />

                {/* Active Directory */}
                <Route path="/active-directory" element={<ActiveDirectoryPage />} />
                <Route path="/active-directory/:id" element={<ActiveDirectoryUserDetailPage />} />

                {/* Users */}
                <Route path="/users" element={<UsersListPage />} />
                <Route path="/users/create" element={<UserCreatePage />} />
                <Route path="/users/:id" element={<UserDetailPage />} />
                <Route path="/users/:id/edit" element={<UserEditPage />} />

                {/* Employees */}
                <Route path="/employees" element={<EmployeesListPage />} />
                <Route path="/employees/create" element={<EmployeeCreatePage />} />
                <Route path="/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />

                {/* Job Titles */}
                <Route path="/job-titles" element={<JobTitlesPage />} />

                {/* Roles */}
                <Route path="/roles" element={<RolesListPage />} />
                <Route path="/roles/create" element={<RoleCreatePage />} />
                <Route path="/roles/:id" element={<RoleEditPage />} />

                {/* News */}
                <Route path="/news" element={<NewsListPage />} />
                <Route path="/news/create" element={<NewsCreatePage />} />
                <Route path="/news/:id" element={<NewsDetailPage />} />
                <Route path="/news/:id/edit" element={<NewsEditPage />} />

                {/* Announcements */}
                <Route path="/announcements" element={<AnnouncementsListPage />} />
                <Route path="/announcements/create" element={<AnnouncementCreatePage />} />
                <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
                <Route path="/announcements/:id/edit" element={<AnnouncementEditPage />} />

                {/* Documents */}
                <Route path="/documents" element={<DocumentsListPage />} />
                <Route path="/documents/create" element={<DocumentCreatePage />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />
                <Route path="/documents/:id/edit" element={<DocumentEditPage />} />

                {/* Media */}
                <Route path="/media" element={<MediaGalleryPage />} />

                {/* Categories */}
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/activity" element={<ActivityLogPage />} />

                {/* Quick Links */}
                <Route path="/quick-links" element={<QuickLinksPage />} />

                {/* Analytics */}
                <Route path="/analytics" element={<AnalyticsPage />} />

                {/* Settings */}
                <Route path="/application-settings" element={<Navigate to="/settings" replace />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Unknown paths inside admin shell */}
                <Route
                  path="*"
                  element={
                    <NotFoundState
                      pageTitle="Page"
                      title="Page not found"
                      description="This page does not exist or the link is out of date."
                      backTo="/dashboard"
                      backLabel="Back to dashboard"
                    />
                  }
                />
              </Route>

              {/* Default redirect — only exact home; unknown public URLs go to login */}
              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              </ErrorBoundary>
            </ToastProvider>
          </PermissionProvider>
        </OrganisationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
