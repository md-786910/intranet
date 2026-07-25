import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import ChatAccessSelector from '../../components/common/ChatAccessSelector';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import ReportsToPicker from '../employees/ReportsToPicker';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { jobTitleService } from '../../services/jobTitleService';
import { useToast } from '../../hooks/useToast';
import { useOrgTree } from '../../hooks/useOrgTree';
import NotFoundState from '../../components/common/NotFoundState';
import { extractValidationErrors, getErrorMessage, getUserFacingMessage, isNotFoundError } from '../../utils/errorUtils';
import { findScopeLabel } from '../../utils/scopeLabel';

const DEFAULT_ORGANISATION_ID = 1;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function buildScopesFromMemberships(memberships = []) {
  return memberships
    .filter((m) => !String(m.membership_id || '').startsWith('derived-'))
    .map((m) => {
      const dept = m.department;
      const scopeType = m.node_type || dept?.node_type || 'DEPARTMENT';
      // Prefer org_node id (authoritative for HierarchyScopeSelector + department_ids).
      const scopeId = m.node_id || dept?.org_node_id || dept?.id || m.department_id;
      const typeLabel = scopeType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
      const verticalName = dept?.vertical?.name;
      const officeName = dept?.vertical?.officeLocation?.name;
      const pathBits = [dept?.name, verticalName, officeName].filter(Boolean);
      return {
        scope_type: scopeType,
        scope_id: scopeId,
        scope_label: `${typeLabel}: ${pathBits.join(' · ') || scopeId}`,
      };
    })
    .filter((s) => s.scope_id != null);
}

function extractPermissionIds(role) {
  if (!role?.permissions) return new Set();
  return new Set(
    role.permissions.filter((p) => p.effect === 'ALLOW')
      .map((p) => p.moduleAction?.module_action_id).filter(Boolean)
  );
}

// ── Role Card (reused from detail page pattern) ──
function RoleCard({ assignment, allRoles, modules, scopeLabel, onRemove, removing }) {
  const [showPerms, setShowPerms] = useState(false);
  const role = allRoles.find((r) => r.role_id === assignment.role_id || r.role_id === assignment.role?.role_id);
  const permissionIds = useMemo(() => extractPermissionIds(role), [role]);
  const permCount = permissionIds.size;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{assignment.role?.name || role?.name || 'Unknown'}</span>
            {(assignment.role?.is_system || role?.is_system) && <Badge variant="info" size="sm">System</Badge>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {scopeLabel || `${assignment.scope_type.replace(/_/g, ' ')} #${assignment.scope_id}`}
            {permCount > 0 && ` · ${permCount} permission${permCount !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {modules.length > 0 && permCount > 0 && (
            <button onClick={() => setShowPerms(!showPerms)}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors">
              {showPerms ? 'Hide permissions' : 'View permissions'}
            </button>
          )}
          {!assignment.role?.is_system && !role?.is_system && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(assignment.assignment_id)}
              loading={removing === assignment.assignment_id}
              className="text-red-500 hover:text-red-700 hover:bg-red-50">Remove</Button>
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

export default function UserEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const detailBackTo = useMemo(() => {
    const from = searchParams.get('from');
    if (from && from.startsWith('/') && !from.startsWith('//') && !from.includes('://')) {
      return `/users/${id}?from=${encodeURIComponent(from)}`;
    }
    return `/users/${id}`;
  }, [id, searchParams]);

  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const { tree: orgTree } = useOrgTree();

  // Profile form
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', status: 'ACTIVE',
    job_title: '', employee_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [resending, setResending] = useState(false);

  // Employee-specific state
  const [reportsTo, setReportsTo] = useState(null);
  const [empScopes, setEmpScopes] = useState([]);
  const [primaryDeptId, setPrimaryDeptId] = useState('');
  const [jobTitles, setJobTitles] = useState([]);
  const [chatCandidates, setChatCandidates] = useState([]);
  const [chatCandidatesLoading, setChatCandidatesLoading] = useState(true);
  const [chatBlockedIds, setChatBlockedIds] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Roles + modules
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [removing, setRemoving] = useState(null);

  // Assign role — supports multi-scope assignment to mirror the Create flow.
  // `assignScopes` is an array of { scope_type, scope_id, scope_label }.
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopes, setAssignScopes] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Inline scope-edit on the Profile summary. Group role_assignments by
  // role_id and edit all of one role's scopes together — picking N scopes
  // in the editor replaces ALL existing assignments for that role with
  // those N new ones.
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editScopes, setEditScopes] = useState([]);
  const [savingScope, setSavingScope] = useState(false);
  const [hasDefaultedRole, setHasDefaultedRole] = useState(false);
  const [showRolePermissions, setShowRolePermissions] = useState(false);

  // Direct permissions — same multi-scope shape as roles.
  const [showPermForm, setShowPermForm] = useState(false);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopes, setPermScopes] = useState([]);
  const [addingPerm, setAddingPerm] = useState(false);
  const [removingPerm, setRemovingPerm] = useState(null);

  // ── Fetch ──
  const fetchUser = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    userService.getUser(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => {
        const u = res.data?.data;
        setUser(u);
        setForm({
          first_name: u.first_name || '', last_name: u.last_name || '',
          phone: u.phone || '', status: u.status || 'ACTIVE',
          job_title: u.profile?.job_title || '', employee_id: u.profile?.employee_id || '',
        });
        if (u.profile?.manager) {
          setReportsTo({ user_id: u.profile.manager.user_id, first_name: u.profile.manager.first_name, last_name: u.profile.manager.last_name, email: u.profile.manager.email });
        } else {
          setReportsTo(null);
        }
        const scopes = buildScopesFromMemberships(u.departmentMemberships);
        setEmpScopes(scopes);
        const primary = (u.departmentMemberships || []).find((m) => m.is_primary && !String(m.membership_id || '').startsWith('derived-'));
        if (primary) {
          setPrimaryDeptId(String(primary.node_id || primary.department?.org_node_id || primary.department?.id || primary.department_id));
        }
        setChatBlockedIds(Array.isArray(u.chat_blocked_user_ids) ? u.chat_blocked_user_ids : []);
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

  useEffect(() => {
    fetchUser();
    setAssignRoleId('');
    setAssignScopes([]);
    setEditingRoleId(null);
    setEditScopes([]);
    setHasDefaultedRole(false);
    setShowRolePermissions(false);
  }, [fetchUser]);

  // Role picker at top — default Employee with current org scopes (Create-like, no duplicate card).
  useEffect(() => {
    if (hasDefaultedRole || loading || !user || allRoles.length === 0) return;
    const employee = allRoles.find((r) => r.code === 'EMPLOYEE');
    const preferred = employee
      || allRoles.find((r) => (user.roleAssignments || []).some(
        (a) => Number(a.role_id || a.role?.role_id) === Number(r.role_id),
      ))
      || allRoles[0];
    if (!preferred) {
      setHasDefaultedRole(true);
      return;
    }
    setAssignRoleId(String(preferred.role_id));
    if (preferred.code === 'EMPLOYEE') {
      if (empScopes.length > 0) {
        setAssignScopes(empScopes);
      } else {
        const fromRole = (user.roleAssignments || [])
          .filter((a) => Number(a.role_id || a.role?.role_id) === Number(preferred.role_id))
          .map((a) => ({
            scope_type: a.scope_type,
            scope_id: a.scope_id,
            scope_label: findScopeLabel(orgTree, a.scope_type, a.scope_id)
              || `${a.scope_type}: #${a.scope_id}`,
          }));
        setAssignScopes(fromRole);
        if (fromRole.length > 0) setEmpScopes(fromRole);
      }
    } else {
      const fromRole = (user.roleAssignments || [])
        .filter((a) => Number(a.role_id || a.role?.role_id) === Number(preferred.role_id))
        .map((a) => ({
          scope_type: a.scope_type,
          scope_id: a.scope_id,
          scope_label: findScopeLabel(orgTree, a.scope_type, a.scope_id)
            || `${a.scope_type}: #${a.scope_id}`,
        }));
      setAssignScopes(fromRole);
    }
    setHasDefaultedRole(true);
  }, [hasDefaultedRole, loading, user, allRoles, empScopes, orgTree]);

  useEffect(() => {
    roleService.getRoles({ limit: 100 }).then((res) => setAllRoles(res.data?.data?.roles || [])).catch(() => {});
    roleService.getModules().then((res) => setModules(res.data?.data || [])).catch(() => {});
    jobTitleService.list().then((res) => setJobTitles(res.data?.data || [])).catch(() => {});
    userService.listChatCandidates()
      .then((res) => setChatCandidates(res.data?.data || []))
      .catch(() => setChatCandidates([]))
      .finally(() => setChatCandidatesLoading(false));
  }, []);

  // ── Profile handlers ──
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  // ── Employee derived ──
  const jobTitleOptions = useMemo(
    () => jobTitles.map((t) => ({ value: t.name, label: t.name })),
    [jobTitles],
  );

  // All selected org units (company / office / vertical / department) — not just DEPARTMENT.
  const orgAssignmentIds = useMemo(
    () => empScopes
      .filter((s) => s.scope_id != null && s.scope_type !== 'GROUP' && s.scope_type !== 'ORGANISATION')
      .map((s) => Number(s.scope_id))
      .filter((id) => Number.isFinite(id)),
    [empScopes],
  );

  const primaryUnitOptions = useMemo(
    () => empScopes
      .filter((s) => s.scope_id != null && s.scope_type !== 'GROUP' && s.scope_type !== 'ORGANISATION')
      .map((s) => ({
        value: String(s.scope_id),
        label: s.scope_label?.replace(/^[^:]+:\s*/, '') || String(s.scope_id),
      })),
    [empScopes],
  );

  useEffect(() => {
    if (primaryDeptId && !orgAssignmentIds.some((id) => String(id) === primaryDeptId)) {
      setPrimaryDeptId('');
    }
  }, [orgAssignmentIds, primaryDeptId]);

  const statusOptions = useMemo(() => {
    if (user?.status === 'INVITED') {
      return [{ value: 'INVITED', label: 'Invited (pending acceptance)' }, ...STATUS_OPTIONS];
    }
    return STATUS_OPTIONS;
  }, [user?.status]);

  const handleSaveProfile = async () => {
    const newErrors = {};
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    // Send every ticked org unit. Filtering to DEPARTMENT-only dropped office/company
    // selections so edits never reached the server.
    const department_ids = orgAssignmentIds.length > 0
      ? orgAssignmentIds
      : empScopes
        .filter((s) => s.scope_type === 'GROUP' || s.scope_type === 'ORGANISATION')
        .map((s) => Number(s.scope_id))
        .filter((id) => Number.isFinite(id));

    setSaving(true);
    try {
      await userService.updateUser(id, {
        first_name: form.first_name, last_name: form.last_name || null,
        phone: form.phone || undefined,
        status: user?.status !== 'INVITED' ? form.status : undefined,
        profile: { job_title: form.job_title || undefined, employee_id: form.employee_id || undefined },
        reports_to_user_id: reportsTo ? reportsTo.user_id : null,
        department_ids: department_ids.length > 0 ? department_ids : undefined,
        primary_department_id: primaryDeptId ? Number(primaryDeptId) : (department_ids[0] || undefined),
        chat_blocked_user_ids: chatBlockedIds,
      });
      addToast('Profile updated', 'success');
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to update'), 'error');
      const ve = extractValidationErrors(err);
      if (Object.keys(ve).length > 0) setErrors(ve);
    } finally { setSaving(false); }
  };

  const handleResendInvite = async () => {
    setResending(true);
    try {
      await userService.resendInvite(id);
      addToast('Invitation resent successfully', 'success');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to resend invitation'), 'error');
    } finally {
      setResending(false);
    }
  };

  // ── Role handlers ──
  const handleAssignRole = async () => {
    if (!assignRoleId) return;
    const roleId = Number(assignRoleId);
    const role = allRoles.find((r) => r.role_id === roleId);
    // No scopes selected → default to Organisation (mirrors Create's behaviour).
    const scopes = assignScopes.length > 0
      ? assignScopes
      : [{ scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID }];

    setAssigning(true);
    try {
      const existing = (user?.roleAssignments || []).filter(
        (a) => Number(a.role_id || a.role?.role_id) === roleId,
      );
      if (existing.length > 0) {
        // Replace scopes for an already-assigned role (Create-like re-pick).
        const keyOf = (s) => `${s.scope_type}:${s.scope_id}`;
        const existingKeys = new Set(existing.map(keyOf));
        const newKeys = new Set(scopes.map(keyOf));
        const toRemove = existing.filter((a) => !newKeys.has(keyOf(a)));
        const toAdd = scopes.filter((s) => !existingKeys.has(keyOf(s)));
        for (const a of toRemove) {
          // eslint-disable-next-line no-await-in-loop
          await userService.removeRole(id, a.assignment_id);
        }
        for (const scope of toAdd) {
          // eslint-disable-next-line no-await-in-loop
          await userService.assignRole(id, {
            role_id: roleId,
            scope_type: scope.scope_type,
            scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
          });
        }
        if (role?.code === 'EMPLOYEE') setEmpScopes(scopes);
        addToast(
          toRemove.length === 0 && toAdd.length === 0
            ? 'No changes to save'
            : `Saved — ${scopes.length} scope${scopes.length === 1 ? '' : 's'} for ${role?.name || 'role'}`,
          toRemove.length === 0 && toAdd.length === 0 ? 'info' : 'success',
        );
      } else {
        for (const scope of scopes) {
          // eslint-disable-next-line no-await-in-loop
          await userService.assignRole(id, {
            role_id: roleId,
            scope_type: scope.scope_type,
            scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
          });
        }
        if (role?.code === 'EMPLOYEE') setEmpScopes(scopes);
        addToast(scopes.length === 1 ? 'Role assigned' : `Role assigned at ${scopes.length} scopes`, 'success');
      }
      setShowAssignForm(false);
      fetchUser();
    } catch (err) { if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed'), 'error'); }
    finally { setAssigning(false); }
  };

  const handleRemoveRole = async (assignmentId) => {
    setRemoving(assignmentId);
    try {
      await userService.removeRole(id, assignmentId);
      addToast('Role removed', 'success'); fetchUser();
    } catch (err) { if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed'), 'error'); }
    finally { setRemoving(null); }
  };

  // Inline-edit all scopes for a single role at once. Pre-fills the
  // selector with every current scope assigned for that role, then on save
  // diffs against the new picks: remove old assignments that aren't in the
  // new set, add new assignments that aren't in the old set, leave matching
  // ones alone (cheaper + avoids a momentary "no access" window).
  const beginEditScopesForRole = (group) => {
    setEditingRoleId(group.roleId);
    setEditScopes(group.assignments.map((a) => ({
      scope_type: a.scope_type,
      scope_id: a.scope_id,
      scope_label: findScopeLabel(orgTree, a.scope_type, a.scope_id) || `${a.scope_type}: #${a.scope_id}`,
    })));
  };

  const cancelEditScope = () => {
    setEditingRoleId(null);
    setEditScopes([]);
  };

  const handleSaveScope = async (group) => {
    if (editScopes.length === 0) {
      addToast('Pick at least one scope', 'error');
      return;
    }
    const roleId = group.roleId;
    setSavingScope(true);
    try {
      // Diff existing vs new. Use a "TYPE:ID" key to compare.
      const keyOf = (s) => `${s.scope_type}:${s.scope_id}`;
      const existingKeys = new Set(group.assignments.map(keyOf));
      const newKeys = new Set(editScopes.map(keyOf));

      const toRemove = group.assignments.filter((a) => !newKeys.has(keyOf(a)));
      const toAdd = editScopes.filter((s) => !existingKeys.has(keyOf(s)));

      for (const a of toRemove) {
        // eslint-disable-next-line no-await-in-loop
        await userService.removeRole(id, a.assignment_id);
      }
      for (const scope of toAdd) {
        // eslint-disable-next-line no-await-in-loop
        await userService.assignRole(id, {
          role_id: Number(roleId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
        });
      }

      if (toRemove.length === 0 && toAdd.length === 0) {
        addToast('No changes to save', 'info');
      } else {
        addToast(`Saved — ${editScopes.length} scope${editScopes.length === 1 ? '' : 's'} assigned`, 'success');
      }
      if (group.role?.code === 'EMPLOYEE') {
        setEmpScopes(editScopes);
        if (Number(assignRoleId) === Number(roleId)) setAssignScopes(editScopes);
      }
      cancelEditScope();
      fetchUser();
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to update scopes'), 'error');
    } finally {
      setSavingScope(false);
    }
  };

  // ── Permission handlers ──
  const handleAssignPerm = async () => {
    if (!permActionId) return;
    const scopes = permScopes.length > 0
      ? permScopes
      : [{ scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID }];

    setAddingPerm(true);
    try {
      for (const scope of scopes) {
        // eslint-disable-next-line no-await-in-loop
        await userService.assignPermission(id, {
          module_action_id: Number(permActionId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
        });
      }
      addToast(scopes.length === 1 ? 'Permission granted' : `Permission granted at ${scopes.length} scopes`, 'success');
      setPermActionId('');
      setPermModuleId('');
      setPermScopes([]);
      setShowPermForm(false);
      fetchUser();
    } catch (err) { if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed'), 'error'); }
    finally { setAddingPerm(false); }
  };

  const handleRemovePerm = async (permissionId) => {
    setRemovingPerm(permissionId);
    try {
      await userService.removePermission(id, permissionId);
      addToast('Permission removed', 'success'); fetchUser();
    } catch (err) { if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed'), 'error'); }
    finally { setRemovingPerm(null); }
  };

  // Role picker includes all roles; tick those already assigned on this user.
  const roleOptions = useMemo(() => {
    const assigned = new Set(
      (user?.roleAssignments || []).map((a) => Number(a.role_id || a.role?.role_id)),
    );
    return allRoles.map((r) => {
      const hasRole = assigned.has(Number(r.role_id));
      const base = `${r.name}${r.is_system ? ' (System)' : ''}`;
      return {
        value: String(r.role_id),
        label: hasRole ? `✓ ${base}` : base,
      };
    });
  }, [allRoles, user?.roleAssignments]);

  const assignPickerRole = assignRoleId ? allRoles.find((r) => r.role_id === Number(assignRoleId)) : null;
  const assignPickerPerms = useMemo(() => extractPermissionIds(assignPickerRole), [assignPickerRole]);

  const handleAssignScopesChange = useCallback((scopes) => {
    setAssignScopes(scopes);
    // Employee scopes are also the org membership saved with the profile.
    if (assignPickerRole?.code === 'EMPLOYEE') {
      setEmpScopes(scopes);
    }
  }, [assignPickerRole?.code]);

  const moduleOptions = useMemo(() => modules.map((m) => ({ value: String(m.module_id), label: m.name })), [modules]);
  const actionOptions = useMemo(() => {
    if (!permModuleId) return [];
    const mod = modules.find((m) => m.module_id === Number(permModuleId));
    if (!mod) return [];
    const existingIds = new Set((user?.directPermissions || []).map((p) => p.module_action_id));
    return mod.actions.filter((a) => !existingIds.has(a.module_action_id))
      .map((a) => { const { label } = getPermLabel(mod.code, a.action_code); return { value: String(a.module_action_id), label }; });
  }, [permModuleId, modules, user?.directPermissions]);

  const directPermCount = user?.directPermissions?.length || 0;

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Edit user"
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
        pageTitle="Edit user"
        title="Unable to load user"
        description="Something went wrong while loading this user."
        backTo="/users"
        backLabel="Back to users"
      />
    );
  }

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'roles', label: `Roles (${user.roleAssignments?.length || 0})` },
    { key: 'permissions', label: `Extra Permissions (${directPermCount})` },
  ];

  const isInvited = user.status === 'INVITED';

  return (
    <div>
      <PageHeader title={`Edit: ${user.first_name} ${user.last_name}`} subtitle={user.email} backTo={detailBackTo} />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-6">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ═══ PROFILE TAB ═══ */}
          {tab === 'profile' && (
            <div className="space-y-5">
              {isInvited && (
                <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    Invitation pending — user has not yet accepted. Status will change to Active once accepted.
                    {user.invitation_expires_at && ` Expires ${new Date(user.invitation_expires_at).toLocaleDateString()}.`}
                  </p>
                  <Button variant="secondary" size="sm" onClick={handleResendInvite} loading={resending}>
                    Resend Invite
                  </Button>
                </div>
              )}
              <Input
                label="Email"
                name="email"
                value={user.email}
                disabled
                helpText="Email is the login identity and can't be changed. To assign a different email, deactivate this account and create a new one."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" name="first_name" required value={form.first_name}
                  error={errors.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" value={form.last_name}
                  error={errors.last_name} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Phone" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="e.g. +91 98765 43210" />
                <Select label="Status" name="status" value={form.status}
                  onChange={handleChange} options={statusOptions} disabled={isInvited} />
              </div>
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Profile</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Job Title" name="job_title" value={form.job_title}
                    onChange={handleChange} options={jobTitleOptions} placeholder="Select a job title" />
                  <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange}
                    placeholder="e.g. EMP-00123" />
                </div>
                <div className="mt-4">
                  <ReportsToPicker label="Reporting To" value={reportsTo} onChange={setReportsTo}
                    excludeUserId={Number(id)}
                    helpText="Search by name or email." />
                </div>
              </div>

              {/* ── Roles & Organisation (role picker at top, like Create) ── */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Roles &amp; Organisation</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Assign the Employee role at organisation units to create memberships and control content access.
                </p>
                {errors.scopes && (
                  <p className="mb-3 text-xs text-red-600">{errors.scopes}</p>
                )}

                <div className="flex items-end gap-3">
                  <Select
                    label="Role"
                    name="role"
                    value={assignRoleId}
                    onChange={(e) => {
                      setAssignRoleId(e.target.value);
                      setShowRolePermissions(false);
                    }}
                    options={roleOptions}
                    placeholder="Select a role…"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleAssignRole}
                    loading={assigning}
                    disabled={!assignRoleId}
                  >
                    {assignPickerRole
                      && (user.roleAssignments || []).some(
                        (a) => Number(a.role_id || a.role?.role_id) === Number(assignRoleId),
                      )
                      ? 'Update'
                      : 'Add'}
                  </Button>
                </div>

                {assignRoleId && (
                  <div className="mt-3 space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-3">Scope this role to one or more org nodes:</p>
                      <HierarchyScopeSelector
                        key={`assign-scopes-${id}`}
                        value={assignScopes}
                        onChange={handleAssignScopesChange}
                      />
                    </div>
                    {primaryUnitOptions.length > 1 && assignPickerRole?.code === 'EMPLOYEE' && (
                      <Select label="Primary Unit" name="primary_department" value={primaryDeptId}
                        onChange={(e) => setPrimaryDeptId(e.target.value)}
                        options={primaryUnitOptions} placeholder="First selected (default)" />
                    )}
                    {assignPickerRole && modules.length > 0 && (
                      <div className="border border-dashed border-gray-300 rounded-lg bg-gray-50/30 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowRolePermissions((v) => !v)}
                          className="w-full flex items-center gap-2 px-4 py-3 text-left"
                        >
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showRolePermissions ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Permissions — {assignPickerRole.name}
                          </span>
                          {assignPickerPerms.size > 0 && (
                            <span className="ml-auto text-[10px] font-medium text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">
                              {assignPickerPerms.size}
                            </span>
                          )}
                        </button>
                        {showRolePermissions && (
                          <div className="px-4 pb-4">
                            <PermissionMatrix modules={modules} selectedPermissions={assignPickerPerms} disabled />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Other assigned roles (skip the one open in the picker above) */}
                {(() => {
                  const otherGroups = [];
                  const groups = new Map();
                  (user.roleAssignments || []).forEach((a) => {
                    const roleId = a.role_id || a.role?.role_id;
                    if (!roleId || Number(roleId) === Number(assignRoleId)) return;
                    if (!groups.has(roleId)) {
                      groups.set(roleId, {
                        roleId,
                        role: a.role || null,
                        isSystem: a.role?.is_system || false,
                        assignments: [],
                      });
                      otherGroups.push(groups.get(roleId));
                    }
                    groups.get(roleId).assignments.push(a);
                  });
                  if (otherGroups.length === 0) return null;
                  return (
                    <ul className="space-y-2 mt-5 pt-5 border-t border-gray-100">
                      {otherGroups.map((group) => {
                        const isEditing = editingRoleId === group.roleId;
                        return (
                          <li key={group.roleId} className="rounded-lg bg-gray-50 border border-gray-200">
                            <div className="flex items-start gap-3 px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-900">{group.role?.name || 'Role'}</span>
                                {group.isSystem && (
                                  <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">System</span>
                                )}
                                <ul className="mt-0.5 space-y-0.5">
                                  {group.assignments.map((a) => {
                                    const label = findScopeLabel(orgTree, a.scope_type, a.scope_id)
                                      || `${a.scope_type.replace(/_/g, ' ')} #${a.scope_id}`;
                                    return (
                                      <li key={a.assignment_id} className="text-xs text-gray-500 truncate">
                                        {label}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignRoleId(String(group.roleId));
                                    cancelEditScope();
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 flex-shrink-0"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>

              {/* ── Advanced: Chat Access ── */}
              <div className="border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showAdvanced ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Advanced
                  <span className="ml-1 text-xs font-normal text-gray-400">Chat Access</span>
                  {chatBlockedIds.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-[10px] font-semibold">
                      1
                    </span>
                  )}
                </button>
                {showAdvanced && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">Chat Access</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Uncheck anyone this user should not be able to find in chat — the block is bidirectional.
                    </p>
                    <ChatAccessSelector candidates={chatCandidates} value={chatBlockedIds}
                      onChange={setChatBlockedIds} loading={chatCandidatesLoading} excludeUserId={Number(id)} />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => navigate(detailBackTo)}>Cancel</Button>
                <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
              </div>
            </div>
          )}

          {/* ═══ ROLES TAB ═══ */}
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
                  <Select label="Role" name="assign_role" value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    options={roleOptions} placeholder="Select a role..." />
                  {assignRoleId && (
                    <>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Assign at one or more scopes:</p>
                        <HierarchyScopeSelector value={assignScopes} onChange={setAssignScopes} />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleAssignRole} loading={assigning} size="md">
                          {assignScopes.length > 1 ? `Assign Role at ${assignScopes.length} scopes` : 'Assign Role'}
                        </Button>
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
                      modules={modules}
                      scopeLabel={findScopeLabel(orgTree, a.scope_type, a.scope_id)}
                      onRemove={handleRemoveRole} removing={removing} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ EXTRA PERMISSIONS TAB ═══ */}
          {tab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{directPermCount} extra permission{directPermCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Individual permissions beyond what roles provide.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowPermForm(!showPermForm)}>
                  {showPermForm ? 'Cancel' : '+ Add Permission'}
                </Button>
              </div>

              {showPermForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Module" name="perm_module" value={permModuleId}
                      onChange={(e) => { setPermModuleId(e.target.value); setPermActionId(''); }}
                      options={moduleOptions} placeholder="Select module..." />
                    <Select label="Action" name="perm_action" value={permActionId}
                      onChange={(e) => setPermActionId(e.target.value)}
                      options={actionOptions}
                      placeholder={permModuleId ? 'Select action...' : 'Select module first'}
                      disabled={!permModuleId} />
                  </div>
                  {permActionId && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Apply at one or more scopes:</p>
                      <HierarchyScopeSelector value={permScopes} onChange={setPermScopes} />
                    </div>
                  )}
                  {permActionId && (
                    <div className="flex justify-end">
                      <Button onClick={handleAssignPerm} loading={addingPerm} size="md">
                        {permScopes.length > 1 ? `Grant at ${permScopes.length} scopes` : 'Grant Permission'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {directPermCount === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No extra permissions.</p>
              ) : (
                <div className="space-y-2">
                  {user.directPermissions.map((perm) => {
                    const moduleCode = perm.moduleAction?.module?.code || '';
                    const actionCode = perm.moduleAction?.action_code || '';
                    const moduleName = perm.moduleAction?.module?.name || moduleCode;
                    const { label } = getPermLabel(moduleCode, actionCode);
                    const scopeLabel = findScopeLabel(orgTree, perm.scope_type, perm.scope_id);
                    return (
                      <div key={perm.user_permission_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500">
                            {moduleName} · {scopeLabel || `${perm.scope_type.replace(/_/g, ' ')} #${perm.scope_id}`}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemovePerm(perm.user_permission_id)}
                          loading={removingPerm === perm.user_permission_id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50">Remove</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
