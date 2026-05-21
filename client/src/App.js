import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganisationProvider } from './contexts/OrganisationContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { PermissionContext } from './contexts/PermissionContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';

// Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import OrganisationPage from './pages/organisation/OrganisationPage';
import UsersListPage from './pages/users/UsersListPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UserEditPage from './pages/users/UserEditPage';
import RoleCategoriesPage from './pages/role-categories/RoleCategoriesPage';
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
import PushListPage from './pages/push/PushListPage';
import PushCreatePage from './pages/push/PushCreatePage';
import PushDetailPage from './pages/push/PushDetailPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import MediaGalleryPage from './pages/media/MediaGalleryPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import ActivityLogPage from './pages/activity/ActivityLogPage';
import QuickLinksPage from './pages/quick-links/QuickLinksPage';

function EmployeeIdRedirect({ suffix = '' }) {
  const { id } = useParams();
  return <Navigate to={`/users/${id}${suffix}`} replace />;
}

function HomeRedirect() {
  const { hasPermission } = useContext(PermissionContext);

  if (hasPermission('ADMIN', 'VIEW_ANALYTICS')) return <Navigate to="/dashboard" replace />;
  if (hasPermission('NEWS', 'VIEW')) return <Navigate to="/news" replace />;
  if (hasPermission('DOCUMENTS', 'VIEW')) return <Navigate to="/documents" replace />;
  if (hasPermission('PUSH', 'VIEW')) return <Navigate to="/push" replace />;
  if (hasPermission('ADMIN', 'MANAGE_EMPLOYEES')) return <Navigate to="/users" replace />;
  if (hasPermission('ADMIN', 'MANAGE_USERS')) return <Navigate to="/users" replace />;
  if (hasPermission('ADMIN', 'MANAGE_ROLES')) return <Navigate to="/roles" replace />;
  if (hasPermission('ADMIN', 'MANAGE_OFFICE_LOCATIONS')) return <Navigate to="/organisation" replace />;

  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganisationProvider>
          <PermissionProvider>
            <ToastProvider>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/invitations/:token" element={<InvitationAcceptPage />} />

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

                {/* Legacy employee routes — redirect to users */}
                <Route path="/employees" element={<Navigate to="/users" replace />} />
                <Route path="/employees/create" element={<Navigate to="/users/create" replace />} />
                <Route path="/employees/:id/edit" element={<EmployeeIdRedirect suffix="/edit" />} />
                <Route path="/employees/:id" element={<EmployeeIdRedirect />} />

                {/* Role Categories */}
                <Route path="/role-categories" element={<RoleCategoriesPage />} />

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

                {/* Push */}
                <Route path="/push" element={<PushListPage />} />
                <Route path="/push/create" element={<PushCreatePage />} />
                <Route path="/push/:id" element={<PushDetailPage />} />

                {/* Media */}
                <Route path="/media" element={<MediaGalleryPage />} />

                {/* Categories */}
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/activity" element={<ActivityLogPage />} />

                {/* Quick Links */}
                <Route path="/quick-links" element={<QuickLinksPage />} />

                {/* Analytics */}
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </ToastProvider>
          </PermissionProvider>
        </OrganisationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
