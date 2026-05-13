import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import FilePicker from '../../components/common/FilePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';
import { usePublishingScope } from '../../hooks/usePublishingScope';

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canCreateDocuments } = usePermission('DOCUMENTS', 'CREATE');
  const { hasPermission: canPublishDocuments } = usePermission('DOCUMENTS', 'PUBLISH');
  const { lockAudience, lockedTargets, owningScope } = usePublishingScope();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', summary: '', category_id: '', priority: 'NORMAL',
  });
  const [files, setFiles] = useState([]);
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (lockAudience) setAudienceTargets(lockedTargets);
  }, [lockAudience, lockedTargets]);

  useEffect(() => {
    if (!currentOrganisationId) return;
    documentService.getCategories({ scope_type: 'ORGANISATION', scope_id: currentOrganisationId })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, [currentOrganisationId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  // Both Save Draft and Publish Now ship the same payload; only the
  // endpoint differs.
  const buildPayload = () => ({
    title: form.title,
    summary: form.summary || null,
    category_id: form.category_id || undefined,
    priority: form.priority || 'NORMAL',
    files,
    owning_scope_type: owningScope.scope_type,
    owning_scope_id: owningScope.scope_id,
    audience_targets: audienceTargets.map((target) => ({
      scope_type: target.scope_type,
      scope_id: target.scope_id,
    })),
  });

  const validate = () => {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required';
    if (!files.length) nextErrors.files = 'Attach at least one file or URL';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return false;
    }
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      await documentService.createDocument(buildPayload());
      addToast('Document created', 'success');
      navigate('/documents');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create document', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Publish Now — create and publish in one shot. Backend fans notifications
  // out to the matched audience as a side-effect.
  const handlePublishNow = async () => {
    if (!validate()) return;
    setPublishing(true);
    setErrors({});
    try {
      await documentService.createAndPublishDocument(buildPayload());
      addToast('Document published — employees will be notified', 'success');
      navigate('/documents');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to publish document', 'error');
    } finally {
      setPublishing(false);
    }
  };

  if (!canCreateDocuments) {
    return <Navigate to="/documents" replace />;
  }

  return (
    <div>
      <PageHeader title="Upload Document" backTo="/documents" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="Title" name="title" required value={form.title} error={errors.title} onChange={handleChange} />
        <Textarea label="Summary" name="summary" value={form.summary} onChange={handleChange} rows={3} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Category" name="category_id" value={form.category_id} onChange={handleChange}
            placeholder="Select category (optional)"
            options={categories.map((c) => ({ value: c.category_id, label: c.name }))}
          />
          <Select label="Priority" name="priority" value={form.priority} onChange={handleChange}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <FilePicker
          label="Files"
          required
          mode="file"
          multiple
          context="document"
          value={files}
          onChange={setFiles}
          error={errors.files}
          helpText="Upload from your computer, pick from the media library, or paste remote URLs. Attach multiple if needed."
        />

        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lockAudience
                ? 'Audience is locked to your assigned scope. Contact a Platform Owner to publish elsewhere.'
                : 'Choose which organisation scopes should be able to view this document once published.'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <HierarchyScopeSelector
              value={audienceTargets}
              onChange={setAudienceTargets}
              disabled={lockAudience}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={publishing}>Save Draft</Button>
          {canPublishDocuments && (
            <Button onClick={handlePublishNow} loading={publishing} disabled={saving}>
              Publish Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
