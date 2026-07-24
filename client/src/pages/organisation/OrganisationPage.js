import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import OrgTreeView from '../../components/org/OrgTreeView';
import Modal from '../../components/common/Modal';
import UserCreatePage from '../users/UserCreatePage';
import { TYPE_COLORS, TYPE_ICONS, NODE_TYPE_LABELS } from '../../components/org/OrgTreeNode';
import OrgNodeMembers from '../../components/org/OrgNodeMembers';
import { orgService, transformOrgTree } from '../../services/orgService';
import { ALLOWED_CHILDREN, ADD_CHILD_LABELS, MEMBER } from '../../utils/constants';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';

// Accent bar colours for the panel header, per node type.
const ACCENT_COLORS = {
  GROUP: 'bg-slate-500',
  COMPANY: 'bg-blue-500',
  OFFICE_LOCATION: 'bg-emerald-500',
  VERTICAL: 'bg-violet-500',
  DEPARTMENT: 'bg-gray-400',
  ADMIN_UNIT: 'bg-amber-500',
};

const EMPTY_FORM = { name: '', code: '', address: '', city: '', country: '', timezone: '' };

export default function OrganisationPage() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // The generic node API is gated on MANAGE_OFFICE_LOCATIONS server-side.
  const { hasPermission: canManageNodes } = usePermission('ADMIN', 'MANAGE_OFFICE_LOCATIONS');

  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Panel: 'view' | 'edit' | 'create' | null
  const [panelMode, setPanelMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [createParent, setCreateParent] = useState(null);
  const [createNodeType, setCreateNodeType] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Member create (modal)
  const [memberPrimary, setMemberPrimary] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  // Sidebar member list (hierarchical)
  const [nodeMembers, setNodeMembers] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);

  const fetchTree = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orgService.getOrgTree();
      setTree(transformOrgTree(res.data?.data));
    } catch {
      addToast('Failed to load organisation tree', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  // Deep-link: /organisation?node=<id>&edit=1
  useEffect(() => {
    if (loading || tree.length === 0) return;
    const nodeId = Number(searchParams.get('node'));
    if (!nodeId) return;

    const findNode = (nodes) => {
      for (const n of nodes || []) {
        if (Number(n.id) === nodeId) return n;
        const nested = findNode(n.children);
        if (nested) return nested;
      }
      return null;
    };

    const target = findNode(tree);
    if (!target) return;

    const wantsEdit = searchParams.get('edit') === '1';
    if (wantsEdit && target.type !== 'GROUP' && canManageNodes) {
      openEdit(target);
    } else {
      openView(target);
    }

    // Clear params so re-selecting the same node later still works
    const next = new URLSearchParams(searchParams);
    next.delete('node');
    next.delete('edit');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tree, searchParams, canManageNodes]);

  const fetchNodeMembers = useCallback(async (nodeId) => {
    if (!nodeId) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await orgService.getNodeMembers(nodeId);
      setNodeMembers(res.data?.data || null);
    } catch {
      setNodeMembers(null);
      setMembersError('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const canAddChildToNode = useCallback((node) => (
    (ALLOWED_CHILDREN[node.type] || []).length > 0 && canManageNodes
  ), [canManageNodes]);

  const canEditNode = useCallback((node) => node.type !== 'GROUP' && canManageNodes, [canManageNodes]);

  // ── Panel actions ──
  const openView = (node) => {
    setSelected(node);
    setPanelMode('view');
    setConfirmDelete(false);
    setNodeMembers(null);
    fetchNodeMembers(node.id);
  };

  const openEdit = (node) => {
    const target = node || selected;
    if (!target || target.type === 'GROUP') return;
    if (!canManageNodes) {
      addToast('You do not have permission to manage the organisation structure', 'error');
      return;
    }
    setSelected(target);
    setForm({
      name: target.name || '', code: target.code || '',
      address: target.address || '', city: target.city || '',
      country: target.country || '', timezone: target.timezone || '',
    });
    setErrors({});
    setPanelMode('edit');
    setConfirmDelete(false);
  };

  const openCreate = (parentNode, childType) => {
    if (!childType || !(ALLOWED_CHILDREN[parentNode.type] || []).includes(childType)) return;
    if (!canManageNodes) {
      addToast('You do not have permission to manage the organisation structure', 'error');
      return;
    }
    setCreateParent(parentNode);
    setCreateNodeType(childType);
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('create');
    setConfirmDelete(false);
  };

  const openMember = (parentNode) => {
    if (!canManageNodes) {
      addToast('You do not have permission to manage members', 'error');
      return;
    }
    setCreateParent(parentNode);
    setMemberPrimary(true);
    setSelected(parentNode);
    setPanelMode('view');
    setConfirmDelete(false);
    setCreateUserOpen(true);
  };

  // onAdd from the tree add-menu: (parentNode, childType)
  const handleAdd = (parentNode, childType) => {
    if (childType === MEMBER) openMember(parentNode);
    else openCreate(parentNode, childType);
  };

  const backToParentView = () => {
    const parent = createParent || selected;
    if (parent) openView(parent);
    else closePanel();
  };

  const closePanel = () => {
    setPanelMode(null);
    setConfirmDelete(false);
    setNodeMembers(null);
    setMembersError(null);
  };

  // ── Save (create / edit) ──
  const handleSave = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const nodeType = panelMode === 'create' ? createNodeType : selected.type;
      const isOffice = nodeType === 'OFFICE_LOCATION';
      const locationFields = isOffice ? {
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
      } : {};

      if (panelMode === 'create') {
        if (!createParent) return;
        await orgService.createNode({
          parent_id: createParent.id,
          node_type: createNodeType,
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          ...locationFields,
        });
        addToast(`${ADD_CHILD_LABELS[createNodeType]} created`, 'success');
      } else {
        await orgService.updateNode(selected.id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          ...locationFields,
        });
        addToast(`${NODE_TYPE_LABELS[selected.type]} updated`, 'success');
      }
      closePanel();
      fetchTree();
    } catch (err) {
      addToast(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Add member (via create-user modal only) ──
  // New user created from the org tree → attach them to this node.
  const handleUserCreated = async (user) => {
    setCreateUserOpen(false);
    if (!user || !createParent) { closePanel(); fetchTree(); return; }
    const parent = createParent;
    try {
      await orgService.addNodeMember(parent.id, {
        user_id: user.user_id,
        is_primary: memberPrimary,
      });
      addToast('User created and added as a member', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'User created, but could not attach as member', 'error');
    } finally {
      fetchTree();
      setSelected(parent);
      setPanelMode('view');
      setConfirmDelete(false);
      fetchNodeMembers(parent.id);
    }
  };

  const memberPresetScope = createParent ? {
    scope_type: createParent.type,
    scope_id: createParent.id,
    scope_label: `${NODE_TYPE_LABELS[createParent.type] || createParent.type}: ${createParent.name}`,
    name: createParent.name,
  } : null;

  // ── Delete ──
  const handleDelete = async () => {
    if (!selected || selected.type === 'GROUP') return;
    setDeleting(true);
    try {
      await orgService.deleteNode(selected.id);
      addToast(`${NODE_TYPE_LABELS[selected.type]} deleted`, 'success');
      closePanel();
      setSelected(null);
      fetchTree();
    } catch (err) {
      addToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const activeNodeType = panelMode === 'create' ? createNodeType : selected?.type;
  const isOffice = activeNodeType === 'OFFICE_LOCATION';
  const hasChildren = selected?.children?.length > 0;
  const allowedChildren = selected ? (ALLOWED_CHILDREN[selected.type] || []) : [];

  const panelTitle =
    panelMode === 'create' ? `New ${ADD_CHILD_LABELS[createNodeType] || ''}` :
    panelMode === 'edit' ? `Edit ${NODE_TYPE_LABELS[selected?.type] || ''}` :
    selected?.name || '';

  const panelAccent = ACCENT_COLORS[activeNodeType || selected?.type] || ACCENT_COLORS.DEPARTMENT;
  const panelTypeColor = TYPE_COLORS[activeNodeType || selected?.type] || TYPE_COLORS.DEPARTMENT;
  const panelIconPath = TYPE_ICONS[activeNodeType || selected?.type] || TYPE_ICONS.DEPARTMENT;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation Structure"
        subtitle="Companies, offices, teams and administrative units — build the structure however you need."
      />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <OrgTreeView
          tree={tree}
          loading={loading}
          selectedId={selected?.id}
          onSelect={openView}
          onEdit={openEdit}
          onRetry={fetchTree}
          canAddNode={canAddChildToNode}
          canEditNode={canEditNode}
        />
      </div>

      {panelMode && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">
            <div className={`h-1 flex-shrink-0 ${panelAccent}`} />

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {(panelMode === 'create' || panelMode === 'edit') && (
                  <button
                    type="button"
                    onClick={panelMode === 'edit' && selected ? () => openView(selected) : backToParentView}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0 transition-colors"
                    title="Back"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                )}
                <span className={`flex-shrink-0 p-2 rounded-lg ${panelTypeColor}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={panelIconPath} />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{panelTitle}</h2>
                  {panelMode === 'view' && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{NODE_TYPE_LABELS[selected?.type]}</span>
                      <StatusBadge status={selected?.status} />
                    </div>
                  )}
                  {panelMode === 'create' && createParent && (
                    <p className="text-xs text-gray-500 mt-0.5">Under: {createParent.name}</p>
                  )}
                </div>
              </div>
              <button onClick={closePanel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-3 flex-shrink-0 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* VIEW */}
              {panelMode === 'view' && selected && (
                <div className="space-y-5">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {selected.code && (
                        <div>
                          <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Code</dt>
                          <dd className="font-medium text-gray-800">{selected.code}</dd>
                        </div>
                      )}
                      {selected.city && (
                        <div>
                          <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">City</dt>
                          <dd className="font-medium text-gray-800">{selected.city}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Children</dt>
                        <dd className="font-medium text-gray-800">{selected.children?.length || 0} direct</dd>
                      </div>
                      {selected.created_at && (
                        <div>
                          <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Created</dt>
                          <dd className="font-medium text-gray-800">{formatDate(selected.created_at)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <OrgNodeMembers
                    data={nodeMembers}
                    loading={membersLoading}
                    error={membersError}
                  />

                  {/* Add-child buttons (one per allowed child type) */}
                  {allowedChildren.length > 0 && canAddChildToNode(selected) && (
                    <div className="flex flex-wrap gap-2">
                      {allowedChildren.map((childType) => (
                        <Button key={childType} variant="secondary" size="sm" onClick={() => handleAdd(selected, childType)}>
                          + {ADD_CHILD_LABELS[childType]}
                        </Button>
                      ))}
                    </div>
                  )}

                  {selected.type !== 'GROUP' && canEditNode(selected) && (
                    <div className="pt-3 border-t border-gray-200">
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          disabled={hasChildren}
                          className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {hasChildren ? 'Cannot delete — has children' : 'Delete this node...'}
                        </button>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-800 font-medium mb-2">Delete &ldquo;{selected.name}&rdquo; permanently?</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>Yes, delete</Button>
                            <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* EDIT / CREATE */}
              {(panelMode === 'edit' || panelMode === 'create') && (
                <div className="space-y-4">
                  <Input
                    label="Name" name="name" required value={form.name} error={errors.name}
                    placeholder={
                      activeNodeType === 'COMPANY' ? 'e.g. BT-Electronics' :
                      activeNodeType === 'ADMIN_UNIT' ? 'e.g. HR' :
                      activeNodeType === 'OFFICE_LOCATION' ? 'e.g. Vienna Office' :
                      activeNodeType === 'VERTICAL' ? 'e.g. Finance' : 'e.g. Invoicing'
                    }
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                  <Input
                    label="Code" name="code" value={form.code}
                    placeholder="Optional short code"
                    helpText="Internal reference. Leave blank to auto-generate."
                    onChange={(e) => updateField('code', e.target.value)}
                  />
                  {isOffice && (
                    <>
                      <Input label="Address" name="address" value={form.address} placeholder="Street address" onChange={(e) => updateField('address', e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="City" name="city" value={form.city} placeholder="e.g. Vienna" onChange={(e) => updateField('city', e.target.value)} />
                        <Input label="Country" name="country" value={form.country} placeholder="e.g. Austria" onChange={(e) => updateField('country', e.target.value)} />
                      </div>
                      <Input label="Timezone" name="timezone" value={form.timezone} placeholder="e.g. Europe/Vienna" helpText="IANA format" onChange={(e) => updateField('timezone', e.target.value)} />
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              {panelMode === 'view' && selected?.type !== 'GROUP' && canEditNode(selected) && (
                <Button variant="primary" className="w-full" onClick={() => openEdit(selected)}>
                  Edit {NODE_TYPE_LABELS[selected?.type]}
                </Button>
              )}
              {panelMode === 'edit' && (
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => openView(selected)}>Cancel</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>Save Changes</Button>
                </div>
              )}
              {panelMode === 'create' && (
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={backToParentView}>Back</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>Create {ADD_CHILD_LABELS[createNodeType]}</Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create-new-user modal — reuses the full user-creation form, pre-scoped
          to the node the admin is adding a member under. */}
      <Modal
        isOpen={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title={`Create user under ${createParent?.name || ''}`}
        size="3xl"
      >
        {createUserOpen && (
          <UserCreatePage
            embedded
            presetScope={memberPresetScope}
            onCreated={handleUserCreated}
            onCancel={() => setCreateUserOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
