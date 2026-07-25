import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import ScopePicker from '../../components/common/ScopePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Table from '../../components/common/Table';
import InlineEditableSelect from '../../components/common/InlineEditableSelect';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { findScopeLabel, findScopePath } from '../../utils/scopeLabel';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { useOrgTree } from '../../hooks/useOrgTree';
import NotFoundState from '../../components/common/NotFoundState';
import { getErrorMessage, getUserFacingMessage, isNotFoundError } from '../../utils/errorUtils';
import ChatDrawer from '../../components/chat/ChatDrawer';

const DEFAULT_ORGANISATION_ID = 1;

const AVATAR_COLORS = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600', 'bg-teal-600',
  'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-fuchsia-600',
];

function hashColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function Avatar({ name, src, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-9 h-9 text-sm';
  const resolved = mediaUrl(src);
  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        className={`${dim} rounded-full object-cover shrink-0 border border-gray-100`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full ${hashColor(name)} flex items-center justify-center text-white font-bold shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

/** Entra-style labelled field row (label left, value right). */
function Field({ label, value, hint, mono = false }) {
  const empty = value === null || value === undefined || value === '';
  const display = empty ? (
    <span className="text-gray-400 italic">{hint || 'Not set'}</span>
  ) : React.isValidElement(value) ? (
    value
  ) : (
    <span className={`${mono ? 'font-mono text-xs' : ''} break-all`}>{String(value)}</span>
  );
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{display}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <dl className="px-5 py-1">{children}</dl>
    </div>
  );
}

function extractPermissionIds(role) {
  if (!role?.permissions) return new Set();
  return new Set(
    role.permissions
      .filter((p) => p.effect === 'ALLOW')
      .map((p) => p.moduleAction?.module_action_id)
      .filter(Boolean)
  );
}

// ── Scope Breadcrumb ──
function ScopeBreadcrumb({ path }) {
  if (!path || path.length === 0) return null;
  return (
    <div className="flex items-center flex-wrap gap-0.5 mt-1.5">
      {path.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && (
            <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            i === path.length - 1
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-500'
          }`}>
            {seg.name}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Role Assignment Card ──
function RoleCard({ assignment, allRoles, modules, onRemove, removing, orgTree }) {
  const [showPerms, setShowPerms] = useState(false);
  const role = allRoles.find((r) => r.role_id === assignment.role_id || r.role_id === assignment.role?.role_id);
  const permissionIds = useMemo(() => extractPermissionIds(role), [role]);
  const permCount = permissionIds.size;
  const scopePath = useMemo(
    () => findScopePath(orgTree, assignment.scope_type, assignment.scope_id),
    [orgTree, assignment.scope_type, assignment.scope_id]
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-start justify-between p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {assignment.role?.name || role?.name || 'Unknown Role'}
            </span>
            {(assignment.role?.is_system || role?.is_system) && (
              <Badge variant="info" size="sm">System</Badge>
            )}
            {permCount > 0 && (
              <span className="text-xs text-gray-400 font-normal">
                {permCount} permission{permCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Org breadcrumb path */}
          {scopePath ? (
            <ScopeBreadcrumb path={scopePath} />
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              {assignment.scope_type.replace(/_/g, ' ')} #{assignment.scope_id}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {modules.length > 0 && permCount > 0 && (
            <button onClick={() => setShowPerms(!showPerms)}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors">
              {showPerms ? 'Hide' : 'Permissions'}
            </button>
          )}
          {!assignment.role?.is_system && !role?.is_system && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(assignment.assignment_id)}
              loading={removing === assignment.assignment_id}
              className="text-red-500 hover:text-red-700 hover:bg-red-50">
              Remove
            </Button>
          )}
        </div>
      </div>
      {showPerms && modules.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
          <PermissionMatrix modules={modules} selectedPermissions={permissionIds} disabled />
        </div>
      )}
    </div>
  );
}

// ── Direct Permission Row ──
function DirectPermissionRow({ perm, onRemove, removing, scopeLabel }) {
  const moduleCode = perm.moduleAction?.module?.code || '';
  const actionCode = perm.moduleAction?.action_code || '';
  const moduleName = perm.moduleAction?.module?.name || moduleCode;
  const { label } = getPermLabel(moduleCode, actionCode);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">
          {moduleName} · {scopeLabel || `${perm.scope_type.replace(/_/g, ' ')} #${perm.scope_id}`}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(perm.user_permission_id)}
        loading={removing === perm.user_permission_id}
        className="text-red-500 hover:text-red-700 hover:bg-red-50">
        Remove
      </Button>
    </div>
  );
}

const REPORT_COLS = [
  {
    key: 'name',
    label: 'Name',
    render: (row) => {
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full ${hashColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {getInitials(name)}
          </div>
          <span className="font-medium text-gray-900">{name}</span>
        </div>
      );
    },
  },
  {
    key: 'job_title',
    label: 'Job Title',
    render: (r) => r.job_title || <span className="text-gray-300">—</span>,
  },
  {
    key: 'department_display',
    label: 'Department',
    render: (r) => r.department_display || <span className="text-gray-300">—</span>,
  },
  {
    key: 'email',
    label: 'Email',
    render: (r) => r.email || <span className="text-gray-300">—</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
];

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { tree: orgTree } = useOrgTree();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('profile');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [permDeleteOpen, setPermDeleteOpen] = useState(false);
  const [permDeleting, setPermDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [editingOrgLink, setEditingOrgLink] = useState(null); // 'company' | 'office' | null
  const [savingOrgLink, setSavingOrgLink] = useState(null);
  const [syncingEntra, setSyncingEntra] = useState(false);
  const [showAdminMeta, setShowAdminMeta] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  // Prefer ?from= when opened from another screen (e.g. Organisation tree).
  // Only allow same-app relative paths.
  const backTo = useMemo(() => {
    const from = searchParams.get('from');
    if (from && from.startsWith('/') && !from.startsWith('//') && !from.includes('://')) {
      return from;
    }
    return '/users';
  }, [searchParams]);

  // Roles & modules
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [removing, setRemoving] = useState(null);

  // Assign role form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopeType, setAssignScopeType] = useState('ORGANISATION');
  const [assignScopeId, setAssignScopeId] = useState(DEFAULT_ORGANISATION_ID);
  const [assigning, setAssigning] = useState(false);

  // Direct permission form
  const [showPermForm, setShowPermForm] = useState(false);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopes, setPermScopes] = useState([]);
  const [addingPerm, setAddingPerm] = useState(false);
  const [removingPerm, setRemovingPerm] = useState(null);

  const [orgChain, setOrgChain] = useState(null);
  const [orgChainLoading, setOrgChainLoading] = useState(false);

  const fetchUser = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    userService.getUser(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => {
        const next = res.data?.data;
        setUser(next);
        setEditingOrgLink(null);
      })
      .catch((err) => {
        setUser(null);
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to load user'), 'error');
      })
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    roleService.getRoles({ limit: 100 }).then((res) => setAllRoles(res.data?.data?.roles || [])).catch(() => {});
    roleService.getModules().then((res) => setModules(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setOrgChain(null);
    setOrgChainLoading(true);
    userService.getOrgChain(id)
      .then((res) => setOrgChain(res.data?.data || null))
      .catch(() => setOrgChain(null))
      .finally(() => setOrgChainLoading(false));
  }, [user, id]);

  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await userService.deleteUser(id);
      addToast('User deactivated', 'success');
      navigate('/users');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to deactivate'), 'error');
    } finally { setDeleting(false); setDeleteOpen(false); }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await userService.reactivateUser(id);
      addToast('User reactivated successfully', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to reactivate'), 'error');
    } finally { setReactivating(false); setReactivateOpen(false); }
  };

  const handlePermanentDelete = async () => {
    setPermDeleting(true);
    try {
      await userService.permanentDeleteUser(id);
      addToast('User permanently deleted', 'success');
      navigate('/users');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to permanently delete'), 'error');
    } finally { setPermDeleting(false); setPermDeleteOpen(false); }
  };

  const handleResendInvite = async () => {
    setResending(true);
    try {
      await userService.resendInvite(id);
      addToast('Invitation resent successfully', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to resend invitation'), 'error');
    } finally { setResending(false); }
  };

  const handleAssignRole = async () => {
    if (!assignRoleId) return;
    setAssigning(true);
    try {
      await userService.assignRole(id, {
        role_id: Number(assignRoleId),
        scope_type: assignScopeType,
        scope_id: assignScopeId || DEFAULT_ORGANISATION_ID,
      });
      addToast('Role assigned successfully', 'success');
      setAssignRoleId('');
      setShowAssignForm(false);
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to assign role'), 'error');
    } finally { setAssigning(false); }
  };

  const handleRemoveRole = async (assignmentId) => {
    setRemoving(assignmentId);
    try {
      await userService.removeRole(id, assignmentId);
      addToast('Role removed', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to remove role'), 'error');
    } finally { setRemoving(null); }
  };

  const handleAssignPermission = async () => {
    if (!permActionId) return;
    setAddingPerm(true);
    try {
      const scopesToAssign = permScopes.length > 0
        ? permScopes
        : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId || DEFAULT_ORGANISATION_ID }];

      const existingPermissions = new Set(
        (user?.directPermissions || []).map((perm) => `${perm.module_action_id}:${perm.scope_type}:${perm.scope_id}`),
      );

      const nextScopes = scopesToAssign.filter((scope) => (
        !existingPermissions.has(`${Number(permActionId)}:${scope.scope_type}:${scope.scope_id}`)
      ));

      if (nextScopes.length === 0) {
        addToast('Permission already assigned at the selected scope', 'error');
        return;
      }

      await Promise.all(
        nextScopes.map((scope) => userService.assignPermission(id, {
          module_action_id: Number(permActionId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id,
        })),
      );

      addToast(
        nextScopes.length === 1 ? 'Permission granted' : `${nextScopes.length} permissions granted`,
        'success',
      );
      setPermActionId('');
      setPermModuleId('');
      setPermScopes([]);
      setShowPermForm(false);
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to assign permission'), 'error');
    } finally { setAddingPerm(false); }
  };

  const handleRemovePermission = async (permissionId) => {
    setRemovingPerm(permissionId);
    try {
      await userService.removePermission(id, permissionId);
      addToast('Permission removed', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to remove permission'), 'error');
    } finally { setRemovingPerm(null); }
  };

  const handleSaveOrgLink = async (kind, rawValue) => {
    const field = kind === 'company' ? 'company_node_id' : 'office_node_id';
    const current = kind === 'company'
      ? (user?.profile?.company_node_id ? String(user.profile.company_node_id) : '')
      : (user?.profile?.office_node_id ? String(user.profile.office_node_id) : '');
    const next = rawValue || '';
    if (next === current) {
      setEditingOrgLink(null);
      return;
    }
    const nodeId = next ? Number(next) : null;
    setSavingOrgLink(kind);
    try {
      await userService.updateUser(id, {
        profile: { [field]: nodeId },
      });
      addToast(kind === 'company' ? 'Company updated' : 'Office updated', 'success');
      setEditingOrgLink(null);
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to update org link'), 'error');
    } finally {
      setSavingOrgLink(null);
    }
  };

  const handleSyncFromEntra = async () => {
    if (!user?.azure_object_id) {
      addToast('User is not linked to Entra', 'error');
      return;
    }
    setSyncingEntra(true);
    try {
      await azureAdService.syncLocalUser(id);
      addToast('Synced from Entra', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to sync from Entra'), 'error');
    } finally {
      setSyncingEntra(false);
    }
  };

  // Derived
  // Root GROUP (organisation) + companies under it
  const companyOptions = useMemo(() => {
    const out = [];
    (orgTree || []).forEach((root) => {
      if (root.type === 'GROUP') {
        out.push({
          value: String(root.id),
          label: `${root.name} (Organisation)`,
        });
      }
      (root.children || []).forEach((n) => {
        if (n.type === 'COMPANY') {
          out.push({ value: String(n.id), label: n.name });
        }
      });
    });
    return out;
  }, [orgTree]);

  const officeOptions = useMemo(() => {
    const out = [];
    const walkOffices = (nodes, companyName) => {
      (nodes || []).forEach((n) => {
        if (n.type === 'OFFICE_LOCATION') {
          out.push({
            value: String(n.id),
            label: companyName ? `${companyName} · ${n.name}` : n.name,
          });
        }
        if (n.children?.length) walkOffices(n.children, companyName);
      });
    };
    (orgTree || []).forEach((root) => {
      (root.children || []).forEach((company) => {
        if (company.type === 'COMPANY') {
          walkOffices(company.children, company.name);
        }
      });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [orgTree]);

  const assignableRoleOptions = useMemo(() => {
    const assigned = new Set((user?.roleAssignments || []).map((a) => a.role_id || a.role?.role_id));
    return allRoles.filter((r) => !assigned.has(r.role_id))
      .map((r) => ({ value: String(r.role_id), label: `${r.name}${r.is_system ? ' (System)' : ''}` }));
  }, [allRoles, user?.roleAssignments]);

  const assignPickerRole = assignRoleId ? allRoles.find((r) => r.role_id === Number(assignRoleId)) : null;
  const assignPickerPerms = useMemo(() => extractPermissionIds(assignPickerRole), [assignPickerRole]);

  const moduleOptions = useMemo(() => modules.map((m) => ({ value: String(m.module_id), label: m.name })), [modules]);
  const actionOptions = useMemo(() => {
    if (!permModuleId) return [];
    const mod = modules.find((m) => m.module_id === Number(permModuleId));
    if (!mod) return [];
    return mod.actions
      .map((a) => { const { label } = getPermLabel(mod.code, a.action_code); return { value: String(a.module_action_id), label }; });
  }, [permModuleId, modules]);

  const directPermCount = user?.directPermissions?.length || 0;

  const orgMemberships = useMemo(() => {
    const rows = [...(user?.departmentMemberships || [])]
      .filter((m) => !String(m.membership_id || '').startsWith('derived-'))
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    return rows.map((m) => {
      const scopeId = m.node_id || m.department?.org_node_id || m.department?.id || m.department_id;
      const scopeType = m.node_type || m.department?.node_type || 'DEPARTMENT';
      const treePath = findScopePath(orgTree, scopeType, scopeId);
      let crumbs;
      if (treePath?.length) {
        crumbs = treePath.map((c) => c.name);
      } else {
        const dept = m.department;
        crumbs = [
          dept?.vertical?.officeLocation?.organisation?.name,
          dept?.vertical?.officeLocation?.name,
          dept?.vertical?.name,
          dept?.name || m.path,
        ].filter(Boolean);
      }
      return {
        key: m.membership_id || `${scopeType}-${scopeId}`,
        crumbs: crumbs.length > 0 ? crumbs : [m.department?.name || 'Unknown unit'],
        nodeType: treePath?.length
          ? treePath[treePath.length - 1].type
          : (String(scopeType).replace(/_/g, ' ')),
        isPrimary: Boolean(m.is_primary),
        source: m.source,
      };
    });
  }, [user?.departmentMemberships, orgTree]);

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (notFound) {
    return (
      <NotFoundState
        pageTitle="User"
        title="User not found"
        description="This user does not exist or is no longer available."
        backTo="/users"
        backLabel="Back to users"
      />
    );
  }
  if (!user) {
    return (
      <NotFoundState
        pageTitle="User"
        title="Unable to load user"
        description="Something went wrong while loading this user."
        backTo="/users"
        backLabel="Back to users"
      />
    );
  }

  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const jobTitle = user.profile?.job_title || null;
  const departmentDisplay = user.profile?.department_display || null;
  const jobDeptLine = [jobTitle, departmentDisplay].filter(Boolean).join(' · ');
  const manager = user.profile?.manager;

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'reports', label: 'Direct Reports', count: orgChain?.direct_reports?.length },
    { key: 'orgpath', label: 'Org Path' },
    { key: 'roles', label: 'Roles', count: user.roleAssignments?.length || 0 },
    { key: 'permissions', label: 'Extra Permissions', count: directPermCount },
  ];

  return (
    <div className="space-y-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      {/* Single profile header: identity + people actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <Avatar name={displayName} src={user.avatar_url} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{displayName}</h1>
              <StatusBadge status={user.status} />
              {user.azure_object_id && (
                <Badge variant="info" size="sm">Entra linked</Badge>
              )}
            </div>
            {jobDeptLine && (
              <p className="text-sm text-gray-600">{jobDeptLine}</p>
            )}
            <p className="text-sm text-gray-500">{user.email}</p>
            {manager && (
              <p className="text-sm text-gray-500">
                Reports to{' '}
                <button
                  type="button"
                  onClick={() => navigate(`/users/${manager.user_id}`)}
                  className="text-primary-600 font-medium hover:underline"
                >
                  {[manager.first_name, manager.last_name].filter(Boolean).join(' ')}
                </button>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {user.email && (
                <a
                  href={`mailto:${user.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Email
                </a>
              )}
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.75 15.75v-1.5A5.25 5.25 0 0111 9h.008c.192.168.2.3.242.042A8.25 8.25 0 0121 12z" />
                </svg>
                Chat
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 sm:pt-0.5">
            {user.azure_object_id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncFromEntra}
                loading={syncingEntra}
                title="Pull latest profile data from Entra / Azure AD"
              >
                Sync from Entra
              </Button>
            )}
            {user.status === 'ACTIVE' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const qs = searchParams.get('from')
                      ? `?from=${encodeURIComponent(searchParams.get('from'))}`
                      : '';
                    navigate(`/users/${id}/edit${qs}`);
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  Deactivate
                </Button>
              </>
            )}
            {user.status === 'INACTIVE' && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setReactivateOpen(true)} loading={reactivating}>
                  Reactivate
                </Button>
                <Button variant="danger" size="sm" onClick={() => setPermDeleteOpen(true)}>
                  Permanently Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 px-5 pt-1 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ═══ PROFILE ═══ */}
          {tab === 'profile' && (
            <div className="space-y-5">
              {user.invitation_pending && (
                <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    Invitation pending — user hasn't accepted yet.
                    {user.invitation_expires_at && ` Expires ${new Date(user.invitation_expires_at).toLocaleDateString()}.`}
                  </p>
                  <Button variant="secondary" size="sm" onClick={handleResendInvite} loading={resending}>
                    Resend Invite
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Section title="Profile">
                  <Field label="Job Title" value={user.profile?.job_title} />
                  <Field label="Department" value={user.profile?.department_display} />
                  <InlineEditableSelect
                    label="Company"
                    valueLabel={user.profile?.companyNode?.name || user.profile?.company_name}
                    status={
                      user.profile?.companyNode
                        ? 'linked'
                        : user.profile?.company_name
                          ? 'unmatched'
                          : 'empty'
                    }
                    unmatchedSource={user.profile?.company_name}
                    options={companyOptions}
                    value={user.profile?.company_node_id ? String(user.profile.company_node_id) : ''}
                    editing={editingOrgLink === 'company'}
                    saving={savingOrgLink === 'company'}
                    editTitle="Change company"
                    onStartEdit={() => setEditingOrgLink('company')}
                    onCancel={() => setEditingOrgLink(null)}
                    onSelect={(v) => handleSaveOrgLink('company', v)}
                  />
                  <Field label="Email" value={user.email} />
                  <Field label="Phone" value={user.phone} />
                  <Field label="Mobile" value={user.mobile_phone} />
                  <InlineEditableSelect
                    label="Office Location"
                    valueLabel={user.profile?.officeNode?.name || user.profile?.location}
                    status={
                      user.profile?.officeNode
                        ? 'linked'
                        : user.profile?.location
                          ? 'unmatched'
                          : 'empty'
                    }
                    unmatchedSource={user.profile?.location}
                    options={officeOptions}
                    value={user.profile?.office_node_id ? String(user.profile.office_node_id) : ''}
                    editing={editingOrgLink === 'office'}
                    saving={savingOrgLink === 'office'}
                    editTitle="Change office"
                    onStartEdit={() => setEditingOrgLink('office')}
                    onCancel={() => setEditingOrgLink(null)}
                    onSelect={(v) => handleSaveOrgLink('office', v)}
                  />
                  <Field
                    label="Manager"
                    value={
                      manager
                        ? (
                          <span>
                            <button
                              type="button"
                              onClick={() => navigate(`/users/${manager.user_id}`)}
                              className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                            >
                              {manager.first_name} {manager.last_name}
                            </button>
                            {manager.email && (
                              <span className="block text-xs text-gray-400 font-mono mt-0.5">{manager.email}</span>
                            )}
                          </span>
                        )
                        : null
                    }
                  />
                </Section>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden self-start">
                  <button
                    type="button"
                    onClick={() => setShowAdminMeta((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                  >
                    <span className="text-sm font-semibold text-gray-700">Admin</span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${showAdminMeta ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showAdminMeta && (
                    <div className="px-5 pb-3">
                      <dl>
                        <Field
                          label="Azure Object ID"
                          value={
                            user.azure_object_id ? (
                              <span className="inline-flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs break-all">{user.azure_object_id}</span>
                                <button
                                  type="button"
                                  onClick={handleSyncFromEntra}
                                  disabled={syncingEntra}
                                  className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                                >
                                  {syncingEntra ? 'Syncing…' : 'Sync now'}
                                </button>
                              </span>
                            ) : null
                          }
                          mono={false}
                          hint="Not linked"
                        />
                        <Field
                          label="Email verified"
                          value={
                            user.email_verified
                              ? <span className="inline-flex items-center gap-1 text-emerald-600">✓ Verified</span>
                              : <span className="inline-flex items-center gap-1 text-amber-600">Pending</span>
                          }
                        />
                        <Field
                          label="Member since"
                          value={formatDate(user.created_at || user.createdAt)}
                        />
                        <Field
                          label="Last login"
                          value={(user.last_login_at || user.lastLoginAt) ? formatDateTime(user.last_login_at || user.lastLoginAt) : null}
                          hint="Never signed in"
                        />
                        <Field
                          label="Last seen"
                          value={(user.last_seen_at || user.lastSeenAt) ? formatRelativeTime(user.last_seen_at || user.lastSeenAt) : null}
                          hint="—"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5">
                          <dt className="w-full sm:w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
                            Organisation
                          </dt>
                          <dd className="text-sm text-gray-800 min-w-0 flex-1">
                            {orgMemberships.length === 0 ? (
                              <span className="text-gray-400 italic">Not assigned</span>
                            ) : (
                              <ul className="space-y-3">
                                {orgMemberships.map((m) => (
                                  <li key={m.key} className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                                        {m.nodeType}
                                      </span>
                                      {m.isPrimary && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                                          Primary
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {m.crumbs.map((crumb, i) => (
                                        <React.Fragment key={`${m.key}-${i}`}>
                                          {i > 0 && (
                                            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                            </svg>
                                          )}
                                          <span className={`text-sm ${i === m.crumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                                            {crumb}
                                          </span>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                    {m.source && (
                                      <p className="text-xs text-gray-400 mt-0.5">{m.source}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <p className="text-xs text-gray-400 pb-2">
                        Incomplete AD data (office, job title, department) yields empty Firma/Büro/Abteilung until On-Prem AD is cleaned. Sync pulls whatever Entra currently has.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ DIRECT REPORTS ═══ */}
          {tab === 'reports' && (
            <div>
              {orgChainLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    {orgChain?.direct_reports?.length || 0} direct report
                    {(orgChain?.direct_reports?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <Table
                    columns={REPORT_COLS}
                    data={orgChain?.direct_reports || []}
                    emptyMessage="No direct reports"
                    onRowClick={(row) => navigate(`/users/${row.user_id}`)}
                  />
                </>
              )}
            </div>
          )}

          {/* ═══ ORG PATH ═══ */}
          {tab === 'orgpath' && (
            <div>
              {orgChainLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {(!orgChain?.ancestors || orgChain.ancestors.length === 0) && !manager && (
                    <p className="text-sm text-gray-400 mb-3">
                      No manager chain — this user is at the top of the hierarchy.
                    </p>
                  )}
                  {(orgChain?.ancestors || []).map((person, idx) => {
                    const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
                    return (
                      <div key={person.user_id} className="flex items-center gap-3" style={{ paddingLeft: `${idx * 24}px` }}>
                        {idx > 0 && (
                          <svg className="w-4 h-4 text-gray-300 shrink-0 -ml-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/users/${person.user_id}`)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group min-w-0 text-left"
                        >
                          <div className={`w-8 h-8 rounded-full ${hashColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">{name}</p>
                            <p className="text-xs text-gray-400">{person.job_title}</p>
                          </div>
                        </button>
                      </div>
                    );
                  })}

                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-200"
                    style={{ paddingLeft: `${(orgChain?.ancestors?.length || 0) * 24 + 12}px` }}
                  >
                    <Avatar name={displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary-800">
                        {displayName}{' '}
                        <span className="text-xs font-normal text-primary-500">(You are here)</span>
                      </p>
                      <p className="text-xs text-primary-600">{jobTitle}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ ROLES ═══ */}
          {tab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {user.roleAssignments?.length || 0} role{(user.roleAssignments?.length || 0) !== 1 ? 's' : ''} assigned
                </p>
                <Button variant="secondary" size="sm" onClick={() => setShowAssignForm(!showAssignForm)}>
                  {showAssignForm ? 'Cancel' : '+ Assign Role'}
                </Button>
              </div>

              {showAssignForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Assign a New Role</h4>
                  <Select label="Role" name="assign_role" value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    options={assignableRoleOptions} placeholder="Select a role..." />

                  {assignRoleId && (
                    <>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Assign at scope:</p>
                        <ScopePicker scopeType={assignScopeType} scopeId={assignScopeId}
                          onScopeTypeChange={setAssignScopeType} onScopeIdChange={setAssignScopeId} />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleAssignRole} loading={assigning} size="md">Assign Role</Button>
                      </div>
                    </>
                  )}

                  {assignPickerRole && modules.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Permissions in {assignPickerRole.name}
                      </h5>
                      <PermissionMatrix modules={modules} selectedPermissions={assignPickerPerms} disabled />
                    </div>
                  )}
                </div>
              )}

              {user.roleAssignments?.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No roles assigned.</p>
              ) : (
                <div className="space-y-3">
                  {user.roleAssignments.map((a) => (
                    <RoleCard key={a.assignment_id} assignment={a} allRoles={allRoles}
                      modules={modules} onRemove={handleRemoveRole} removing={removing}
                      orgTree={orgTree} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ EXTRA PERMISSIONS ═══ */}
          {tab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {directPermCount} extra permission{directPermCount !== 1 ? 's' : ''} assigned
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Individual permissions granted beyond what their roles provide.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowPermForm(!showPermForm)}>
                  {showPermForm ? 'Cancel' : '+ Add Permission'}
                </Button>
              </div>

              {showPermForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Grant an Extra Permission</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Module" name="perm_module" value={permModuleId}
                      onChange={(e) => { setPermModuleId(e.target.value); setPermActionId(''); setPermScopes([]); }}
                      options={moduleOptions} placeholder="Select module..." />
                    <Select label="Action" name="perm_action" value={permActionId}
                      onChange={(e) => setPermActionId(e.target.value)}
                      options={actionOptions}
                      placeholder={permModuleId ? 'Select action...' : 'Select module first'}
                      disabled={!permModuleId} />
                  </div>
                  {permActionId && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Apply at scope:</p>
                      <HierarchyScopeSelector value={permScopes} onChange={setPermScopes} />
                    </div>
                  )}
                  {permActionId && (
                    <div className="flex justify-end">
                      <Button onClick={handleAssignPermission} loading={addingPerm} size="md">Grant Permission</Button>
                    </div>
                  )}
                </div>
              )}

              {directPermCount === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No extra permissions. Use this to grant individual permissions without assigning a full role.
                </p>
              ) : (
                <div className="space-y-2">
                  {user.directPermissions.map((perm) => (
                    <DirectPermissionRow key={perm.user_permission_id} perm={perm}
                      scopeLabel={findScopeLabel(orgTree, perm.scope_type, perm.scope_id)}
                      onRemove={handleRemovePermission} removing={removingPerm} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deactivate */}
      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={handleDeactivate}
        loading={deleting} title="Deactivate User"
        message={`Deactivate "${user.first_name} ${user.last_name}"? They will lose access immediately but can be reactivated later.`} />

      {/* Reactivate */}
      <ConfirmDialog isOpen={reactivateOpen} onCancel={() => setReactivateOpen(false)} onConfirm={handleReactivate}
        loading={reactivating} title="Reactivate User"
        message={`Reactivate "${user.first_name} ${user.last_name}"? They will regain access to the platform immediately.`} />

      {/* Permanent Delete */}
      <ConfirmDialog isOpen={permDeleteOpen} onCancel={() => setPermDeleteOpen(false)} onConfirm={handlePermanentDelete}
        loading={permDeleting} title="Permanently Delete User"
        message={`Permanently delete "${user.first_name} ${user.last_name}"? This cannot be undone — they will be removed from all lists and cannot be reactivated.`} />

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        userId={user.user_id}
        displayName={displayName}
        jobTitle={user.profile?.job_title}
        avatarUrl={user.avatar_url}
      />
    </div>
  );
}
