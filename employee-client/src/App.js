import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import NotFoundState from './components/common/NotFoundState';
import ErrorBoundary from './components/common/ErrorBoundary';
import EmployeeLayout from './components/layout/EmployeeLayout';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import InvitationAcceptPage from './pages/auth/InvitationAcceptPage';
import HomePage from './pages/home/HomePage';
import { ContentRefreshProvider } from './contexts/ContentRefreshContext';
import { ChatUnreadProvider } from './contexts/ChatUnreadContext';
import NewsListPage from './pages/news/NewsListPage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import AnnouncementsListPage from './pages/announcements/AnnouncementsListPage';
import AnnouncementDetailPage from './pages/announcements/AnnouncementDetailPage';
import PublicNewsSharePage from './pages/news/PublicNewsSharePage';
import PeoplePage from './pages/people/PeoplePage';
import DocumentsPage from './pages/documents/DocumentsPage';
import CategoryDetailPage from './pages/documents/CategoryDetailPage';
import PoliciesPage from './pages/policies/PoliciesPage';
import OrgChartPage from './pages/org-chart/OrgChartPage';
import DirectoryProfilePage from './pages/directory/DirectoryProfilePage';
import SettingsPage from './pages/settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ErrorBoundary homeTo="/home" homeLabel="Back to home">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/invitations/:token" element={<InvitationAcceptPage />} />
            <Route path="/s/:token" element={<PublicNewsSharePage />} />

            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <ChatUnreadProvider>
                      <ContentRefreshProvider>
                        <EmployeeLayout />
                      </ContentRefreshProvider>
                    </ChatUnreadProvider>
                  </SocketProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/news" element={<NewsListPage />} />
              <Route path="/news/:id" element={<NewsDetailPage />} />
              <Route path="/announcements" element={<AnnouncementsListPage />} />
              <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/categories/:id" element={<CategoryDetailPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/org-chart" element={<OrgChartPage />} />
              <Route path="/directory/:userId" element={<DirectoryProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route
                path="*"
                element={
                  <NotFoundState
                    pageTitle="Page"
                    title="Page not found"
                    description="This page does not exist or the link is out of date."
                    backTo="/home"
                    backLabel="Back to home"
                  />
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
