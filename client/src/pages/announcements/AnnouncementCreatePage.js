import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import RichTextEditor from '../../components/common/RichTextEditor';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { announcementService } from '../../services/announcementService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';
import { usePublishingScope } from '../../hooks/usePublishingScope';

function toLocalInputValue(isoOrNull) {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AnnouncementCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canCreate } = usePermission('NEWS', 'CREATE');
  const { hasPermission: canPublish } = usePermission('NEWS', 'PUBLISH');
  const { lockAudience, lockedTargets, owningScope } = usePublishingScope();
  const [form, setForm] = useState({
    title: '',
    body: '',
    priority: 'NORMAL',
    show_in_marquee: false,
    marquee_starts_at: '',
    marquee_ends_at: '',
  });
  const [pushNotify, setPushNotify] = useState(true);
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (lockAudience) setAudienceTargets(lockedTargets);
  }, [lockAudience, lockedTargets]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors({ ...errors, [name]: null });
  };

  const buildPayload = () => ({
    title: form.title,
    body: form.body,
    priority: form.priority || 'NORMAL',
    show_in_marquee: Boolean(form.show_in_marquee),
    marquee_starts_at: fromLocalInputValue(form.marquee_starts_at),
    marquee_ends_at: fromLocalInputValue(form.marquee_ends_at),
    owning_scope_type: owningScope.scope_type,
    owning_scope_id: owningScope.scope_id,
    audience_targets: audienceTargets.map((t) => ({ scope_type: t.scope_type, scope_id: t.scope_id })),
    push_notify: pushNotify,
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
      await announcementService.create(buildPayload());
      addToast('Announcement saved as draft', 'success');
      navigate('/announcements');
    } catch (err) {
      handleError(err, 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setPublishing(true);
    setErrors({});
    try {
      await announcementService.createAndPublish(buildPayload());
      addToast('Announcement published', 'success');
      navigate('/announcements');
    } catch (err) {
      handleError(err, 'Failed to publish announcement');
    } finally {
      setPublishing(false);
    }
  };

  if (!canCreate) {
    return <Navigate to="/announcements" replace />;
  }

  return (
    <div>
      <PageHeader title="Create Announcement" subtitle="Broadcast an update to employees" backTo="/announcements" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="Title" name="title" required value={form.title} error={errors.title} onChange={handleChange} />

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
            placeholder="Write the announcement body…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="show_in_marquee"
              checked={Boolean(form.show_in_marquee)}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Show in employee marquee</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            When enabled (and the announcement is published), it scrolls in the header ticker
            within the active window below.
          </p>

          {form.show_in_marquee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <Input
                label="Marquee starts at"
                name="marquee_starts_at"
                type="datetime-local"
                value={form.marquee_starts_at}
                onChange={handleChange}
                helpText="Leave empty for immediate start."
              />
              <Input
                label="Marquee ends at"
                name="marquee_ends_at"
                type="datetime-local"
                value={form.marquee_ends_at}
                onChange={handleChange}
                helpText="Leave empty for no automatic end."
              />
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lockAudience
                ? 'Audience is locked to your assigned scope. Contact a Platform Owner to publish elsewhere.'
                : 'Choose which organisation scopes should see this announcement after it is published.'}
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

        {canPublish && (
          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pushNotify}
                onChange={(e) => setPushNotify(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-700">Push notify employees in real-time</span>
                <span className="block text-xs text-gray-500">
                  Sends an instant in-app notification to the audience. Uncheck to publish silently.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/announcements')}>Cancel</Button>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={publishing}>Save Draft</Button>
          {canPublish && (
            <Button onClick={handlePublishNow} loading={publishing} disabled={saving}>
              Publish Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// re-export helper for the edit page
export { toLocalInputValue, fromLocalInputValue };
