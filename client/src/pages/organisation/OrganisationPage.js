import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import OrgTreeView from '../../components/org/OrgTreeView';
import { orgService } from '../../services/orgService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { NODE_TYPE_LABELS } from '../../utils/constants';

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

const EMPTY_FORM = { name: '', code: '', address: '', city: '', country: '', timezone: '' };

export default function OrganisationPage() {
  const { addToast } = useToast();
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
      setTree(res.data?.data || []);
    } catch {
      addToast('Failed to load organisation tree', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  // ── Panel actions ──
  const openView = (node) => {
    setSelected(node);
    setPanelMode('view');
    setConfirmDelete(false);
  };

  const openEdit = (node) => {
    const target = node || selected;
    if (!target || target.node_type === 'ORGANISATION') return;
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
    const childType = CHILD_TYPE_MAP[parentNode.node_type];
    if (!childType) return;
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
      const nodeType = panelMode === 'create' ? createNodeType : selected.node_type;
      const isOffice = nodeType === 'OFFICE_LOCATION';
      const locationFields = isOffice ? {
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
      } : {};

      if (panelMode === 'create') {
        if (!createParent) return;
        await getCreateEndpoint(createNodeType)({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          parent_org_unit_id: createParent.org_unit_id,
          org_unit_id: createParent.org_unit_id,
          ...locationFields,
        });
        addToast(`${NODE_TYPE_LABELS[createNodeType]} created`, 'success');
      } else {
        const scopeId = selected.parent_org_unit_id || selected.org_unit_id;
        await getUpdateEndpoint(selected.node_type)(selected.org_unit_id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          org_unit_id: scopeId,
          ...locationFields,
        });
        addToast(`${NODE_TYPE_LABELS[selected.node_type]} updated`, 'success');
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
    if (!selected || selected.node_type === 'ORGANISATION') return;
    setDeleting(true);
    try {
      await getDeleteEndpoint(selected.node_type)(selected.org_unit_id);
      addToast(`${NODE_TYPE_LABELS[selected.node_type]} deleted`, 'success');
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

  // For the form — which node type are we editing/creating?
  const activeNodeType = panelMode === 'create' ? createNodeType : selected?.node_type;
  const isOffice = activeNodeType === 'OFFICE_LOCATION';
  const hasChildren = selected?.children?.length > 0;
  const panelTitle =
    panelMode === 'create' ? `New ${CHILD_LABEL_MAP[createParent?.node_type] || ''}` :
    panelMode === 'edit' ? `Edit ${NODE_TYPE_LABELS[selected?.node_type] || ''}` :
    selected?.name || '';

  return (
    <div>
      <PageHeader
        title="Organisation Structure"
        subtitle="Manage your offices, verticals, and departments."
      />

      {/* ── Tree ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <OrgTreeView
          tree={tree}
          loading={loading}
          selectedId={selected?.org_unit_id}
          onSelect={openView}
          onAdd={openCreate}
          onEdit={openEdit}
          onRetry={fetchTree}
        />
      </div>

      {/* ── Slide-out Panel (view / edit / create — all in one) ── */}
      {panelMode && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">

            {/* ── Panel Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{panelTitle}</h2>
                {panelMode === 'view' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{NODE_TYPE_LABELS[selected?.node_type]}</span>
                    <StatusBadge status={selected?.status} />
                  </div>
                )}
                {panelMode === 'create' && createParent && (
                  <p className="text-xs text-gray-500 mt-1">
                    Under: {createParent.name}
                  </p>
                )}
              </div>
              <button onClick={closePanel} className="p-1 text-gray-400 hover:text-gray-600 rounded ml-3 flex-shrink-0">
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

                  {/* Details */}
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

                  {/* Add child */}
                  {selected.node_type !== 'DEPARTMENT' && (
                    <Button variant="secondary" size="sm" onClick={() => openCreate(selected)}>
                      + Add {CHILD_LABEL_MAP[selected.node_type]}
                    </Button>
                  )}

                  {/* Delete zone */}
                  {selected.node_type !== 'ORGANISATION' && (
                    <div className="pt-4 mt-2 border-t border-gray-100">
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
                            Delete "{selected.name}" permanently?
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
            <div className="px-6 py-4 border-t border-gray-200">
              {panelMode === 'view' && selected?.node_type !== 'ORGANISATION' && (
                <Button variant="primary" className="w-full" onClick={() => openEdit(selected)}>
                  Edit {NODE_TYPE_LABELS[selected?.node_type]}
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
