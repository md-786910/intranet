import React, { useState, useEffect } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';

export default function NewsEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canEditNews } = usePermission('NEWS', 'EDIT');
  const [form, setForm] = useState({ title: '', summary: '', body: '', cover_image_url: '' });
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    newsService.getArticle(id)
      .then((res) => {
        const a = res.data?.data;
        setForm({ title: a.title, summary: a.summary || '', body: a.body || '', cover_image_url: a.cover_image_url || '' });
        setAudienceTargets((a.audienceRules || []).map((rule) => ({
          scope_type: rule.target_scope_type,
          scope_id: rule.target_scope_id,
          scope_label: rule.scope_label,
        })));
      })
      .catch(() => addToast('Failed to load article', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await newsService.updateArticle(id, {
        ...form,
        scope_type: 'ORGANISATION',
        scope_id: currentOrganisationId,
        audience_targets: audienceTargets.map((target) => ({
          scope_type: target.scope_type,
          scope_id: target.scope_id,
        })),
      });
      addToast('Article updated', 'success');
      navigate(`/news/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canEditNews) {
    return <Navigate to={`/news/${id}`} replace />;
  }

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;

  return (
    <div>
      <PageHeader title="Edit Article" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />
        <Input label="Summary" name="summary" value={form.summary} onChange={handleChange} />
        <Textarea label="Body" name="body" required value={form.body} onChange={handleChange} rows={12} />
        <Input label="Cover Image URL" name="cover_image_url" value={form.cover_image_url} onChange={handleChange} />
        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              Update the organisation scopes that should receive this article when it is published.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <HierarchyScopeSelector value={audienceTargets} onChange={setAudienceTargets} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate(`/news/${id}`)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
