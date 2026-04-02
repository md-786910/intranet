import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import OrgTreeView from '../../components/org/OrgTreeView';
import { TYPE_COLORS, TYPE_ICONS, NODE_TYPE_LABELS } from '../../components/org/OrgTreeNode';
import { orgService, transformOrgTree } from '../../services/orgService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';

const CHILD_TYPE_MAP = {
  ORGANISATION: 'OFFICE_LOCATION',
  OFFICE_LOCATION: 'VERTICAL',
  VERTICAL: 'DEPARTMENT',
};

const CHILD_LABEL_MAP = {
  ORGANISATION: 'Office Location',
  OFFICE_LOCATION: 'Vertical',
  VERTICAL: 'Department',
};

// Accent bar colors for the panel header
const ACCENT_COLORS = {
  ORGANISATION: 'bg-blue-500',
  OFFICE_LOCATION: 'bg-emerald-500',
  VERTICAL: 'bg-amber-500',
  DEPARTMENT: 'bg-gray-400',
};

function getCreateEndpoint(t) {
  return t === 'OFFICE_LOCATION' ? orgService.createOfficeLocation
    : t === 'VERTICAL' ? orgService.createVertical
    : t === 'DEPARTMENT' ? orgService.createDepartment : null;
}
function getUpdateEndpoint(t) {
  return t === 'OFFICE_LOCATION' ? orgService.updateOfficeLocation
    : t === 'VERTICAL' ? orgService.updateVertical
    : t === 'DEPARTMENT' ? orgService.updateDepartment : null;
}
function getDeleteEndpoint(t) {
  return t === 'OFFICE_LOCATION' ? orgService.deleteOfficeLocation
    : t === 'VERTICAL' ? orgService.deleteVertical
    : t === 'DEPARTMENT' ? orgService.deleteDepartment : null;
}

function getManageScopeForCreate(parentNode, childType) {
  if (!parentNode || !childType) return null;

  if (childType === 'OFFICE_LOCATION') {
    return { scope_type: 'ORGANISATION', scope_id: parentNode.id };
  }

  if (childType === 'VERTICAL') {
    return { scope_type: 'OFFICE_LOCATION', scope_id: parentNode.id };
  }

  if (childType === 'DEPARTMENT') {
    return { scope_type: 'VERTICAL', scope_id: parentNode.id };
  }

  return null;
}

function getManageScopeForNode(node) {
  if (!node) return null;
  return { scope_type: node.type, scope_id: node.id };
}

const EMPTY_FORM = { name: '', code: '', address: '', city: '', country: '', timezone: '' };

export default function OrganisationPage() {
  const { addToast } = useToast();
  const { hasPermission: canManageOfficeLocations } = usePermission('ADMIN', 'MANAGE_OFFICE_LOCATIONS');
  const { hasPermission: canManageVerticals } = usePermission('ADMIN', 'MANAGE_VERTICALS');
  const { hasPermission: canManageDepartments } = usePermission('ADMIN', 'MANAGE_DEPARTMENTS');
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Panel state: 'view' | 'edit' | 'create' | null
  const [panelMode, setPanelMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [createParent, setCreateParent] = useState(null);
  const [createNodeType, setCreateNodeType] = useState('');

  // Form
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──
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

  const canManageNodeType = useCallback((nodeType) => (
    nodeType === 'OFFICE_LOCATION' ? canManageOfficeLocations
      : nodeType === 'VERTICAL' ? (canManageVerticals || canManageOfficeLocations)
      : nodeType === 'DEPARTMENT' ? (canManageDepartments || canManageVerticals || canManageOfficeLocations)
      : false
  ), [canManageDepartments, canManageOfficeLocations, canManageVerticals]);

  const canAddChildToNode = useCallback((node) => {
    const childType = CHILD_TYPE_MAP[node.type];
    if (!childType) return false;
    if (childType === 'OFFICE_LOCATION') return canManageOfficeLocations;
    if (childType === 'VERTICAL') return canManageOfficeLocations || canManageVerticals;
    if (childType === 'DEPARTMENT') return canManageOfficeLocations || canManageVerticals;
    return false;
  }, [canManageNodeType]);

  const canEditNode = useCallback((node) => canManageNodeType(node.type), [canManageNodeType]);

  // ── Panel actions ──
  const openView = (node) => {
    setSelected(node);
    setPanelMode('view');
    setConfirmDelete(false);
  };

  const openEdit = (node) => {
    const target = node || selected;
    if (!target || target.type === 'ORGANISATION') return;
    if (!canManageNodeType(target.type)) {
      addToast(`You do not have permission to manage ${NODE_TYPE_LABELS[target.type].toLowerCase()}s`, 'error');
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

  const openCreate = (parentNode) => {
    const childType = CHILD_TYPE_MAP[parentNode.type];
    if (!childType) return;
    if (!canManageNodeType(childType)) {
      addToast(`You do not have permission to create ${NODE_TYPE_LABELS[childType].toLowerCase()}s`, 'error');
      return;
    }
    setCreateParent(parentNode);
    setCreateNodeType(childType);
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('create');
    setConfirmDelete(false);
  };

  const closePanel = () => {
    setPanelMode(null);
    setConfirmDelete(false);
  };

  // ── Save ──
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
        const parentFkMap = {
          OFFICE_LOCATION: { organisation_id: createParent.id },
          VERTICAL: { office_location_id: createParent.id },
          DEPARTMENT: { vertical_id: createParent.id },
        };
        const manageScope = getManageScopeForCreate(createParent, createNodeType);
        await getCreateEndpoint(createNodeType)({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          ...parentFkMap[createNodeType],
          ...locationFields,
          ...manageScope,
        });
        addToast(`${NODE_TYPE_LABELS[createNodeType]} created`, 'success');
      } else {
        const manageScope = getManageScopeForNode(selected);
        await getUpdateEndpoint(selected.type)(selected.id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          ...locationFields,
          ...manageScope,
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

  // ── Delete ──
  const handleDelete = async () => {
    if (!selected || selected.type === 'ORGANISATION') return;
    setDeleting(true);
    try {
      await getDeleteEndpoint(selected.type)(selected.id, getManageScopeForNode(selected));
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
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const activeNodeType = panelMode === 'create' ? createNodeType : selected?.type;
  const isOffice = activeNodeType === 'OFFICE_LOCATION';
  const hasChildren = selected?.children?.length > 0;
  const panelTitle =
    panelMode === 'create' ? `New ${CHILD_LABEL_MAP[createParent?.type] || ''}` :
    panelMode === 'edit' ? `Edit ${NODE_TYPE_LABELS[selected?.type] || ''}` :
    selected?.name || '';

  const panelAccent = ACCENT_COLORS[activeNodeType || selected?.type] || ACCENT_COLORS.DEPARTMENT;
  const panelTypeColor = TYPE_COLORS[activeNodeType || selected?.type] || TYPE_COLORS.DEPARTMENT;
  const panelIconPath = TYPE_ICONS[activeNodeType || selected?.type] || TYPE_ICONS.DEPARTMENT;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation Structure"
        subtitle="Manage your offices, verticals, and departments."
      />

      {/* ── Tree ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <OrgTreeView
          tree={tree}
          loading={loading}
          selectedId={selected?.id}
          onSelect={openView}
          onAdd={openCreate}
          onEdit={openEdit}
          onRetry={fetchTree}
          canAddNode={canAddChildToNode}
          canEditNode={canEditNode}
        />
      </div>

      {/* ── Slide-out Panel ── */}
      {panelMode && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">

            {/* Colored accent bar */}
            <div className={`h-1 flex-shrink-0 ${panelAccent}`} />

            {/* ── Panel Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <p className="text-xs text-gray-500 mt-0.5">
                      Under: {createParent.name}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={closePanel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-3 flex-shrink-0 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Panel Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ════════ VIEW MODE ════════ */}
              {panelMode === 'view' && selected && (
                <div className="space-y-6">
                  {/* Path */}
                  {selected.path && (
                    <div>
                      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Path</dt>
                      <dd className="text-sm text-gray-600 font-mono">{selected.path.replace(/\./g, ' / ')}</dd>
                    </div>
                  )}

                  {/* Details card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      {selected.code && (
                        <div>
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Code</dt>
                          <dd className="font-medium text-gray-800">{selected.code}</dd>
                        </div>
                      )}
                      {selected.city && (
                        <div>
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">City</dt>
                          <dd className="font-medium text-gray-800">{selected.city}</dd>
                        </div>
                      )}
                      {selected.country && (
                        <div>
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Country</dt>
                          <dd className="font-medium text-gray-800">{selected.country}</dd>
                        </div>
                      )}
                      {selected.timezone && (
                        <div>
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Timezone</dt>
                          <dd className="font-medium text-gray-800">{selected.timezone}</dd>
                        </div>
                      )}
                      {selected.address && (
                        <div className="col-span-2">
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Address</dt>
                          <dd className="font-medium text-gray-800">{selected.address}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Created</dt>
                        <dd className="font-medium text-gray-800">{formatDate(selected.created_at)}</dd>
                      </div>
                      {selected.children && (
                        <div>
                          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Children</dt>
                          <dd className="font-medium text-gray-800">{selected.children.length} direct</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Add child */}
                  {selected.type !== 'DEPARTMENT' && canAddChildToNode(selected) && (
                    <Button variant="secondary" size="sm" onClick={() => openCreate(selected)}>
                      + Add {CHILD_LABEL_MAP[selected.type]}
                    </Button>
                  )}

                  {/* Delete zone */}
                  {selected.type !== 'ORGANISATION' && canEditNode(selected) && (
                    <div className="pt-4 mt-2 border-t border-gray-200">
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
                          <p className="text-sm text-red-800 font-medium mb-2">
                            Delete &ldquo;{selected.name}&rdquo; permanently?
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>
                              Yes, delete
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ════════ EDIT / CREATE MODE ════════ */}
              {(panelMode === 'edit' || panelMode === 'create') && (
                <div className="space-y-4">
                  <Input
                    label="Name"
                    name="name"
                    required
                    value={form.name}
                    error={errors.name}
                    placeholder={
                      activeNodeType === 'OFFICE_LOCATION' ? 'e.g. Mumbai Office' :
                      activeNodeType === 'VERTICAL' ? 'e.g. Engineering' : 'e.g. Frontend Team'
                    }
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                  <Input
                    label="Code"
                    name="code"
                    value={form.code}
                    placeholder="Optional short code"
                    helpText="Internal reference. Leave blank to auto-generate."
                    onChange={(e) => updateField('code', e.target.value)}
                  />

                  {isOffice && (
                    <>
                      <Input label="Address" name="address" value={form.address}
                        placeholder="Street address"
                        onChange={(e) => updateField('address', e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="City" name="city" value={form.city}
                          placeholder="e.g. Mumbai"
                          onChange={(e) => updateField('city', e.target.value)} />
                        <Input label="Country" name="country" value={form.country}
                          placeholder="e.g. India"
                          onChange={(e) => updateField('country', e.target.value)} />
                      </div>
                      <Input label="Timezone" name="timezone" value={form.timezone}
                        placeholder="e.g. Asia/Kolkata"
                        helpText="IANA format (America/New_York, Europe/London)"
                        onChange={(e) => updateField('timezone', e.target.value)} />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Panel Footer ── */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              {panelMode === 'view' && selected?.type !== 'ORGANISATION' && canEditNode(selected) && (
                <Button variant="primary" className="w-full" onClick={() => openEdit(selected)}>
                  Edit {NODE_TYPE_LABELS[selected?.type]}
                </Button>
              )}

              {panelMode === 'edit' && (
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => openView(selected)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>
                    Save Changes
                  </Button>
                </div>
              )}

              {panelMode === 'create' && (
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={closePanel}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>
                    Create {NODE_TYPE_LABELS[createNodeType]}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
