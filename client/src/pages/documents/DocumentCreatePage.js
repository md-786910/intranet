import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canCreateDocuments } = usePermission('DOCUMENTS', 'CREATE');
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', summary: '', category_id: '', file_url: '', file_name: '',
  });
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrganisationId) return;
    documentService.getCategories({ scope_type: 'ORGANISATION', scope_id: currentOrganisationId })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, [currentOrganisationId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.title.trim() || !form.file_url.trim() || !form.file_name.trim()) {
      addToast('Title, file URL, and file name are required', 'error');
      return;
    }
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setSaving(true);
    try {
      await documentService.createDocument({
        ...form,
        category_id: form.category_id || undefined,
        owning_scope_type: 'ORGANISATION',
        owning_scope_id: currentOrganisationId,
        audience_targets: audienceTargets.map((target) => ({
          scope_type: target.scope_type,
          scope_id: target.scope_id,
        })),
      });
      addToast('Document created', 'success');
      navigate('/documents');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create document', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateDocuments) {
    return <Navigate to="/documents" replace />;
  }

  return (
    <div>
      <PageHeader title="Upload Document" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />
        <Textarea label="Summary" name="summary" value={form.summary} onChange={handleChange} rows={3} />
        <Select label="Category" name="category_id" value={form.category_id} onChange={handleChange}
          placeholder="Select category (optional)"
          options={categories.map((c) => ({ value: c.category_id, label: c.name }))}
        />
        <Input label="File URL" name="file_url" required value={form.file_url} onChange={handleChange}
          placeholder="/uploads/filename.pdf" />
        <Input label="File Name" name="file_name" required value={form.file_name} onChange={handleChange}
          placeholder="document.pdf" />
        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose which organisation scopes should be able to view this document once published.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <HierarchyScopeSelector value={audienceTargets} onChange={setAudienceTargets} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Document</Button>
        </div>
      </div>
    </div>
  );
}
