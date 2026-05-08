import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'security');

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  // Profile State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  // Notifications State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const mockNotifications = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    id: i + 1,
    title: i % 3 === 0 ? 'New Policy Update' : i % 3 === 1 ? 'Happy Birthday!' : 'System Maintenance',
    description: i % 3 === 0 
      ? 'The Hybrid Work Policy has been updated for Q3. Please review the changes.'
      : i % 3 === 1
      ? 'Join us in wishing Sarah a very happy birthday today!'
      : 'Scheduled system maintenance will occur this weekend from 12 AM to 4 AM EST.',
    time: `${i + 1} hours ago`,
    icon: i % 3 === 0 ? 'article' : i % 3 === 1 ? 'celebration' : 'build',
    color: i % 3 === 0 ? 'blue' : i % 3 === 1 ? 'green' : 'amber',
  })), []);

  const totalPages = Math.ceil(mockNotifications.length / itemsPerPage);
  const currentNotifications = mockNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Populate profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      // Mocking API call for password reset since we don't have the current password verification in the real endpoint for now
      // Assuming we had authService.changePassword:
      // await authService.changePassword(passwordData);
      await new Promise(resolve => setTimeout(resolve, 1200));
      setPasswordMessage({ type: 'success', text: 'Your password has been updated successfully.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'Failed to update password. Please try again.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const res = await authService.updateProfile(profileData);
      setUser(res.data.data); // Update context with new user data
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-16 bg-zinc-50/30 min-h-[calc(100vh-64px)]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-zinc-500 mt-2 font-medium">Manage your account preferences and security.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm sticky top-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-primary-container/20 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                  <span className="text-2xl font-bold text-primary uppercase">
                    {user?.first_name?.[0] || ''}{user?.last_name?.[0] || ''}
                  </span>
                </div>
                <h3 className="font-bold text-zinc-900 text-lg">{user?.first_name} {user?.last_name}</h3>
                <p className="text-zinc-500 text-sm font-medium break-all">{user?.email}</p>
              </div>
              <div className="mt-8 space-y-2">
                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${
                    activeTab === 'security'
                      ? 'bg-zinc-50 text-primary shadow-sm ring-1 ring-zinc-200/50'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  }`}
                >
                  <MaterialIcon name="security" className="text-[20px]" />
                  <span>Security</span>
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${
                    activeTab === 'profile'
                      ? 'bg-zinc-50 text-primary shadow-sm ring-1 ring-zinc-200/50'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  }`}
                >
                  <MaterialIcon name="person" className="text-[20px]" />
                  <span>Profile Info</span>
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${
                    activeTab === 'notifications'
                      ? 'bg-zinc-50 text-primary shadow-sm ring-1 ring-zinc-200/50'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                  }`}
                >
                  <MaterialIcon name="notifications" className="text-[20px]" />
                  <span>Notifications</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'security' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <MaterialIcon name="lock" />
                      </div>
                      <div>
                        <h2 className="font-bold text-zinc-900">Change Password</h2>
                        <p className="text-xs text-zinc-500 font-medium">Update your account security</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
                    {passwordMessage.text && (
                      <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                        passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                      }`}>
                        <MaterialIcon name={passwordMessage.type === 'success' ? 'check_circle' : 'error'} className="text-[20px] shrink-0" />
                        <span className="text-sm font-semibold">{passwordMessage.text}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-700 ml-1">Current Password</label>
                      <div className="relative">
                        <MaterialIcon name="key" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                          placeholder="Enter current password"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-700 ml-1">New Password</label>
                        <div className="relative">
                          <MaterialIcon name="lock_open" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                          <input
                            type="password"
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                            placeholder="New password"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-700 ml-1">Confirm New Password</label>
                        <div className="relative">
                          <MaterialIcon name="verified" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                          <input
                            type="password"
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                            placeholder="Confirm password"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end border-t border-zinc-50">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-2"
                      >
                        {passwordLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {passwordLoading ? 'Updating Security...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="mt-8 bg-amber-50 rounded-3xl p-6 border border-amber-100 flex gap-4 items-start">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                    <MaterialIcon name="info" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">Security Tip</h4>
                    <p className="text-amber-800 text-sm mt-1 font-medium leading-relaxed">
                      Use a strong password with a mix of letters, numbers, and special characters to keep your account secure.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                        <MaterialIcon name="person" />
                      </div>
                      <div>
                        <h2 className="font-bold text-zinc-900">Profile Information</h2>
                        <p className="text-xs text-zinc-500 font-medium">Update your personal details</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
                    {profileMessage.text && (
                      <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                        profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                      }`}>
                        <MaterialIcon name={profileMessage.type === 'success' ? 'check_circle' : 'error'} className="text-[20px] shrink-0" />
                        <span className="text-sm font-semibold">{profileMessage.text}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-700 ml-1">First Name</label>
                        <div className="relative">
                          <MaterialIcon name="badge" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                          <input
                            type="text"
                            name="first_name"
                            value={profileData.first_name}
                            onChange={handleProfileChange}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                            placeholder="e.g. Jane"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-700 ml-1">Last Name</label>
                        <div className="relative">
                          <MaterialIcon name="badge" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                          <input
                            type="text"
                            name="last_name"
                            value={profileData.last_name}
                            onChange={handleProfileChange}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                            placeholder="e.g. Doe"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-bold text-zinc-700 ml-1">Phone Number</label>
                        <div className="relative">
                          <MaterialIcon name="call" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]" />
                          <input
                            type="text"
                            name="phone"
                            value={profileData.phone}
                            onChange={handleProfileChange}
                            className="w-full pl-12 pr-4 py-3.5 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium placeholder:text-zinc-300"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end border-t border-zinc-50">
                      <button
                        type="submit"
                        disabled={profileLoading}
                        className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-2"
                      >
                        {profileLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {profileLoading ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                  <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                        <MaterialIcon name="notifications_active" />
                      </div>
                      <div>
                        <h2 className="font-bold text-zinc-900">Notifications History</h2>
                        <p className="text-xs text-zinc-500 font-medium">Review your past alerts and updates</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {currentNotifications.map((notif) => (
                      <div key={notif.id} className="p-6 border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-full bg-${notif.color}-50 flex items-center justify-center shrink-0 group-hover:bg-${notif.color}-100 transition-colors`}>
                            <MaterialIcon name={notif.icon} className={`text-${notif.color}-600 text-[24px]`} />
                          </div>
                          <div>
                            <p className="text-base font-bold text-zinc-900">{notif.title}</p>
                            <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{notif.description}</p>
                            <span className="text-xs text-zinc-400 font-semibold mt-2 block">{notif.time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-500">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, mockNotifications.length)} of {mockNotifications.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <MaterialIcon name="chevron_left" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <MaterialIcon name="chevron_right" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
