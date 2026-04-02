import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';

export default function NewsCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canCreateNews } = usePermission('NEWS', 'CREATE');
  const [form, setForm] = useState({ title: '', summary: '', body: '', cover_image_url: '' });
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleSave = async () => {
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await newsService.createArticle({
        ...form,
        owning_scope_type: 'ORGANISATION',
        owning_scope_id: currentOrganisationId,
        audience_targets: audienceTargets.map((target) => ({
          scope_type: target.scope_type,
          scope_id: target.scope_id,
        })),
      });
      addToast('Article created as draft', 'success');
      navigate('/news');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create article');
      addToast(message, 'error');
      
      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateNews) {
    return <Navigate to="/news" replace />;
  }

  return (
    <div>
      <PageHeader title="Create Article" subtitle="Write a news article" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-4">
        <Input label="Title" name="title" required value={form.title} error={errors.title} onChange={handleChange} />
        <Input label="Summary" name="summary" value={form.summary} error={errors.summary} onChange={handleChange}
          placeholder="Brief summary (optional)" />
        <Textarea label="Body" name="body" required value={form.body} error={errors.body} onChange={handleChange} rows={12} />
        <Input label="Cover Image URL" name="cover_image_url" value={form.cover_image_url} error={errors.cover_image_url} onChange={handleChange}
          placeholder="https://..." />
        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose which organisation scopes should see this article after it is published.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <HierarchyScopeSelector value={audienceTargets} onChange={setAudienceTargets} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/news')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Draft</Button>
        </div>
      </div>
    </div>
  );
}
