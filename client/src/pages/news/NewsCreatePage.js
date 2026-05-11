import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import MultiSelect from '../../components/common/MultiSelect';
import RichTextEditor from '../../components/common/RichTextEditor';
import FilePicker from '../../components/common/FilePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { newsService } from '../../services/newsService';
import { categoryService } from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';

export default function NewsCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canCreateNews } = usePermission('NEWS', 'CREATE');
  const { hasPermission: canPublishNews } = usePermission('NEWS', 'PUBLISH');
  const [form, setForm] = useState({
    title: '', summary: '', body: '', category_id: '', priority: 'NORMAL',
  });
  const [cover, setCover] = useState(null);
  const [relatedIds, setRelatedIds] = useState([]); // array of string ids for MultiSelect
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [otherArticles, setOtherArticles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    categoryService.list({ entity_type: 'NEWS', limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setCategories(res.data?.data?.categories || []);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    newsService.getArticles({ status: 'PUBLISHED', limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setOtherArticles(res.data?.data?.articles || []);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  // Build the API payload from the current form once — both Save Draft and
  // Publish Now ship the same body shape; only the endpoint differs.
  const buildPayload = () => ({
    title: form.title,
    summary: form.summary || null,
    body: form.body,
    category_id: form.category_id ? Number(form.category_id) : null,
    priority: form.priority || 'NORMAL',
    cover_image_url: cover?.url || null,
    cover_image_id: cover?.media_asset_id || null,
    related_news_ids: relatedIds.map((v) => Number(v)).filter(Boolean),
    owning_scope_type: 'ORGANISATION',
    owning_scope_id: currentOrganisationId,
    audience_targets: audienceTargets.map((target) => ({
      scope_type: target.scope_type,
      scope_id: target.scope_id,
    })),
  });

  const handleError = (err, fallback) => {
    addToast(getErrorMessage(err, fallback), 'error');
    const validationErrors = extractValidationErrors(err);
    if (Object.keys(validationErrors).length > 0) setErrors(validationErrors);
  };

  const handleSave = async () => {
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await newsService.createArticle(buildPayload());
      addToast('Article created as draft', 'success');
      navigate('/news');
    } catch (err) {
      handleError(err, 'Failed to create article');
    } finally {
      setSaving(false);
    }
  };

  // Publish Now — create and publish in one shot. The backend fans
  // notifications out to the matched audience as a side-effect.
  const handlePublishNow = async () => {
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setPublishing(true);
    setErrors({});
    try {
      await newsService.createAndPublishArticle(buildPayload());
      addToast('Article published — employees will be notified', 'success');
      navigate('/news');
    } catch (err) {
      handleError(err, 'Failed to publish article');
    } finally {
      setPublishing(false);
    }
  };

  if (!canCreateNews) {
    return <Navigate to="/news" replace />;
  }

  return (
    <div>
      <PageHeader title="Create Article" subtitle="Write a news article" backTo="/news" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="Title" name="title" required value={form.title} error={errors.title} onChange={handleChange} />
        <Input label="Summary" name="summary" value={form.summary} error={errors.summary} onChange={handleChange}
          placeholder="Brief summary (optional)" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Body <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={form.body}
            onChange={(html) => {
              setForm((prev) => ({ ...prev, body: html }));
              if (errors.body) setErrors({ ...errors, body: null });
            }}
            error={errors.body}
            imageContext="news"
            placeholder="Write the article body…"
          />
        </div>

        <FilePicker
          label="Cover image"
          mode="image"
          context="news"
          value={cover}
          onChange={setCover}
          helpText="Upload, pick from the media library, or paste a remote URL."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Category"
            name="category_id"
            value={form.category_id}
            onChange={handleChange}
            error={errors.category_id}
            placeholder="Select category (optional)"
            options={categories.map((c) => ({ value: String(c.category_id), label: c.name }))}
          />
          <Select
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <MultiSelect
          label="Related articles"
          name="related_news_ids"
          value={relatedIds}
          onChange={setRelatedIds}
          placeholder="Pick up to 10 related articles..."
          options={otherArticles.map((a) => ({
            value: String(a.news_item_id),
            label: a.title,
          }))}
          helpText="Surface other articles alongside this one on the detail page."
        />

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
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={publishing}>Save Draft</Button>
          {canPublishNews && (
            <Button onClick={handlePublishNow} loading={publishing} disabled={saving}>
              Publish Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
