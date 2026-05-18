import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import MultiSelect from '../../components/common/MultiSelect';
import RichTextEditor from '../../components/common/RichTextEditor';
import FilePicker from '../../components/common/FilePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import SchedulePopover from '../../components/common/SchedulePopover';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { newsService } from '../../services/newsService';
import { categoryService } from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';
import { usePermission } from '../../hooks/usePermission';
import { usePublishingScope } from '../../hooks/usePublishingScope';

export default function NewsEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canEditNews } = usePermission('NEWS', 'EDIT');
  const { hasPermission: canPublishNews } = usePermission('NEWS', 'PUBLISH');
  const { lockAudience, lockedTargets, owningScope } = usePublishingScope();
  const [form, setForm] = useState({ title: '', summary: '', body: '', category_id: '', priority: 'NORMAL' });
  const [cover, setCover] = useState(null);
  const [relatedIds, setRelatedIds] = useState([]);
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [otherArticles, setOtherArticles] = useState([]);
  const [status, setStatus] = useState('DRAFT');
  const [pushNotify, setPushNotify] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduleBtnRef = useRef(null);

  useEffect(() => {
    newsService.getArticle(id)
      .then((res) => {
        const a = res.data?.data;
        setForm({
          title: a.title,
          summary: a.summary || '',
          body: a.body || '',
          category_id: a.category_id ? String(a.category_id) : '',
          priority: a.priority || 'NORMAL',
        });
        if (a.cover_image_url) {
          setCover({
            url: a.cover_image_url,
            name: (a.cover_image_url.split('/').pop()) || 'cover',
            mime: 'image/*',
            size: null,
            media_asset_id: a.cover_image_id || null,
            source: a.cover_image_id ? 'upload' : 'url',
          });
        } else {
          setCover(null);
        }
        setStatus(a.status || 'DRAFT');
        setPushNotify(a.push_notify !== false);
        setRelatedIds((a.related_news_ids || []).map((rid) => String(rid)));
        setAudienceTargets((a.audienceRules || []).map((rule) => ({
          scope_type: rule.target_scope_type,
          scope_id: rule.target_scope_id,
          scope_label: rule.scope_label,
        })));
      })
      .catch(() => addToast('Failed to load article', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => {
    if (lockAudience && !loading) setAudienceTargets(lockedTargets);
  }, [lockAudience, lockedTargets, loading]);

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const buildUpdatePayload = () => ({
    title: form.title,
    summary: form.summary || null,
    body: form.body,
    category_id: form.category_id ? Number(form.category_id) : null,
    priority: form.priority || 'NORMAL',
    cover_image_url: cover?.url || null,
    cover_image_id: cover?.media_asset_id || null,
    related_news_ids: relatedIds.map((v) => Number(v)).filter(Boolean),
    scope_type: owningScope.scope_type,
    scope_id: owningScope.scope_id,
    audience_targets: audienceTargets.map((target) => ({
      scope_type: target.scope_type,
      scope_id: target.scope_id,
    })),
    push_notify: pushNotify,
  });

  const handleSave = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await newsService.updateArticle(id, buildUpdatePayload());
      addToast('Article updated', 'success');
      navigate(`/news/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save edits then move to SCHEDULED. Mirrors handleSaveAndPublish but routes
  // through scheduleArticle instead of publishArticle.
  const handleSaveAndSchedule = async ({ iso }) => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setScheduling(true);
    try {
      await newsService.updateArticle(id, buildUpdatePayload());
      await newsService.scheduleArticle(id, { scheduled_at: iso });
      addToast(`Article scheduled for ${new Date(iso).toLocaleString()}`, 'success');
      navigate(`/news/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to schedule', 'error');
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  // Save edits then immediately publish, honoring the push-notify toggle.
  const handleSaveAndPublish = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setPublishing(true);
    try {
      await newsService.updateArticle(id, buildUpdatePayload());
      await newsService.publishArticle(id, { push_notify: pushNotify });
      addToast(pushNotify ? 'Article published — employees notified' : 'Article published', 'success');
      navigate(`/news/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  if (!canEditNews) {
    return <Navigate to={`/news/${id}`} replace />;
  }

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;

  // Don't offer this article as one of its own related entries.
  const relatedOptions = otherArticles
    .filter((a) => String(a.news_item_id) !== String(id))
    .map((a) => ({ value: String(a.news_item_id), label: a.title }));

  return (
    <div>
      <PageHeader title="Edit Article" backTo={`/news/${id}`} />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />
        <Input label="Summary" name="summary" value={form.summary} onChange={handleChange} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Body <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={form.body}
            onChange={(html) => setForm((p) => ({ ...p, body: html }))}
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
          options={relatedOptions}
          helpText="Surface other articles alongside this one on the detail page."
        />

        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lockAudience
                ? 'Audience is locked to your assigned scope. Contact a Platform Owner to publish elsewhere.'
                : 'Update the organisation scopes that should receive this article when it is published.'}
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
        {canPublishNews && (
          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pushNotify}
                onChange={(e) => setPushNotify(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-700">Push notify employees in real-time on publish</span>
                <span className="block text-xs text-gray-500">
                  Sends an instant in-app notification to the audience when this article is published. Uncheck to publish silently.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="ghost" onClick={() => navigate(`/news/${id}`)}>Cancel</Button>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={publishing || scheduling}>Save Changes</Button>
          {canPublishNews && status === 'DRAFT' && (
            <>
              <Button onClick={handleSaveAndPublish} loading={publishing} disabled={saving || scheduling}>
                Save &amp; Publish
              </Button>
              <Button
                ref={scheduleBtnRef}
                variant="tonal"
                onClick={() => setScheduleOpen((v) => !v)}
                disabled={saving || publishing}
              >
                Publish Later
              </Button>
            </>
          )}
        </div>
        <SchedulePopover
          open={scheduleOpen}
          anchorRef={scheduleBtnRef}
          saving={scheduling}
          onCancel={() => setScheduleOpen(false)}
          onSave={handleSaveAndSchedule}
        />
      </div>
    </div>
  );
}
