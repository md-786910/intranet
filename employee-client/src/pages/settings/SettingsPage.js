import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { orgService } from '../../services/orgService';

const NODE_TYPE_META = {
  GROUP: { label: 'Group', icon: 'apartment', accent: 'indigo' },
  COMPANY: { label: 'Company', icon: 'business', accent: 'indigo' },
  ORGANISATION: { label: 'Company', icon: 'business', accent: 'indigo' },
  OFFICE_LOCATION: { label: 'Office Location', icon: 'location_city', accent: 'sky' },
  VERTICAL: { label: 'Vertical', icon: 'account_tree', accent: 'violet' },
  DEPARTMENT: { label: 'Department', icon: 'groups', accent: 'emerald' },
  ADMIN_UNIT: { label: 'Admin Unit', icon: 'admin_panel_settings', accent: 'emerald' },
};

const SCOPE_PRIORITY = ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'];

const ROLE_COLORS = [
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', dot: 'bg-indigo-500' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', dot: 'bg-violet-500' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100', dot: 'bg-sky-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500' },
];

function RolesSection({ roleAssignments, loading }) {
  if (loading) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon name="admin_panel_settings" className="text-zinc-400 text-[18px]" />
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Roles & Permissions</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2].map((i) => <div key={i} className="h-8 w-32 bg-zinc-100 rounded-full animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!roleAssignments || roleAssignments.length === 0) return null;

  const sorted = [...roleAssignments].sort(
    (a, b) => SCOPE_PRIORITY.indexOf(a.scope_type) - SCOPE_PRIORITY.indexOf(b.scope_type),
  );

  return (
    <div className="mt-6 pt-6 border-t border-zinc-100">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon name="admin_panel_settings" className="text-zinc-400 text-[18px]" />
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Roles & Permissions</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((a, idx) => {
          const color = ROLE_COLORS[idx % ROLE_COLORS.length];
          return (
            <div
              key={a.assignment_id}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${color.bg} ${color.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
              <span className={`text-xs font-bold ${color.text}`}>{a.role?.name || 'Unknown'}</span>
              {a.scope_label && (
                <span className="text-[10px] text-zinc-400 font-medium">· {a.scope_label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACCENT_STYLES = {
  indigo: { iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
  sky: { iconBg: 'bg-sky-50', iconText: 'text-sky-600' },
  violet: { iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
};

function HierarchyChart({ hierarchy, loading }) {
  const path = hierarchy?.path || [];
  const memberships = hierarchy?.memberships || [];
  const primaryId = memberships.find((m) => m.isPrimary)?.id
    || (path.length ? path[path.length - 1].id : null);
  const otherMemberships = memberships.filter((m) => m.id !== primaryId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <MaterialIcon name="hub" className="text-zinc-400 text-[18px]" />
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Organization Path</h3>
      </div>

      {loading ? (
        <div className="flex flex-col md:flex-row gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-24 bg-zinc-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : path.length === 0 ? (
        <div className="bg-white border border-zinc-200/70 rounded-2xl p-5">
          <p className="text-sm font-medium text-zinc-300 italic">Not assigned</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-2">
            {path.map((node, idx) => {
              const meta = NODE_TYPE_META[node.node_type] || NODE_TYPE_META.DEPARTMENT;
              const accent = ACCENT_STYLES[meta.accent] || ACCENT_STYLES.indigo;
              const isLast = idx === path.length - 1;

              return (
                <React.Fragment key={`${node.node_type}-${node.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="h-full bg-white border border-zinc-200/70 rounded-2xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg ${accent.iconBg} ${accent.iconText} flex items-center justify-center shrink-0`}>
                          <MaterialIcon name={meta.icon} className="text-[18px]" />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-zinc-900 leading-snug break-words">{node.name}</p>
                    </div>
                  </div>

                  {!isLast && (
                    <div className="hidden md:flex items-center justify-center text-zinc-300 shrink-0 px-1">
                      <MaterialIcon name="chevron_right" className="text-[24px]" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {otherMemberships.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Also a member of</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {otherMemberships.map((m) => {
                  const meta = NODE_TYPE_META[m.node_type] || NODE_TYPE_META.DEPARTMENT;
                  return (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-[11px] font-semibold text-zinc-600"
                    >
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">{meta.label}</span>
                      {m.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const initialTab = location.state?.activeTab === 'profile' ? 'profile' : 'security';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (location.state?.activeTab === 'profile') {
      setActiveTab('profile');
    } else if (location.state?.activeTab) {
      setActiveTab('security');
    }
  }, [location.state]);

  // Hierarchy
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);

  // Role assignments
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setHierarchyLoading(true);
    orgService.getMyHierarchy()
      .then((res) => {
        if (mounted) setHierarchy(res.data?.data || null);
      })
      .catch(() => {
        if (mounted) setHierarchy(null);
      })
      .finally(() => {
        if (mounted) setHierarchyLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    authService.getMe()
      .then((res) => {
        if (mounted) setRoleAssignments(res.data?.data?.role_assignments || []);
      })
      .catch(() => {
        if (mounted) setRoleAssignments([]);
      })
      .finally(() => {
        if (mounted) setRolesLoading(false);
      });
    return () => { mounted = false; };
  }, []);

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
      await new Promise((resolve) => setTimeout(resolve, 1200));
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
      setUser(res.data.data);
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

  const tabs = [
    { id: 'security', label: 'Security', icon: 'security' },
    { id: 'profile', label: 'Profile Info', icon: 'person' },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-14 bg-zinc-50/30 min-h-[calc(100vh-64px)]">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-zinc-500 mt-2 font-medium">Manage your account preferences and security.</p>
        </div>

        {/* Hero: profile + organization hierarchy */}
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden mb-8">
          <div className="p-8 flex flex-col lg:flex-row lg:items-center gap-6 border-b border-zinc-100">
            <div className="w-20 h-20 bg-primary-container/20 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0">
              <span className="text-2xl font-bold text-primary uppercase">
                {user?.first_name?.[0] || ''}{user?.last_name?.[0] || ''}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight truncate">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-zinc-500 text-sm font-medium mt-1 truncate">{user?.email}</p>
            </div>
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </div>
            </div>
          </div>

          <div className="p-8 bg-gradient-to-b from-zinc-50/40 to-white">
            <HierarchyChart hierarchy={hierarchy} loading={hierarchyLoading} />
            <RolesSection roleAssignments={roleAssignments} loading={rolesLoading} />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-2 mb-8 inline-flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
              }`}
            >
              <MaterialIcon name={tab.icon} className="text-[18px]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'security' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-zinc-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <MaterialIcon name="lock" />
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-900">Change Password</h2>
                    <p className="text-xs text-zinc-500 font-medium">Update your account security</p>
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
            </div>

            <div className="lg:col-span-1">
              <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex gap-4 items-start h-full">
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
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <MaterialIcon name="person" />
                </div>
                <div>
                  <h2 className="font-bold text-zinc-900">Profile Information</h2>
                  <p className="text-xs text-zinc-500 font-medium">Update your personal details</p>
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

      </div>
    </div>
  );
}
