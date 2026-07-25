import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import RichTextEditor from '../../components/common/RichTextEditor';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import SchedulePopover from '../../components/common/SchedulePopover';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { announcementService } from '../../services/announcementService';
import { useToast } from '../../hooks/useToast';
import { usePermission } from '../../hooks/usePermission';
import { usePublishingScope } from '../../hooks/usePublishingScope';
import { toLocalInputValue, fromLocalInputValue } from './AnnouncementCreatePage';
import NotFoundState from '../../components/common/NotFoundState';
import { getErrorMessage, getUserFacingMessage, isNotFoundError } from '../../utils/errorUtils';

export default function AnnouncementEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canEdit } = usePermission('NEWS', 'EDIT');
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
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [status, setStatus] = useState('DRAFT');
  const [pushNotify, setPushNotify] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduleBtnRef = useRef(null);

  useEffect(() => {
    setNotFound(false);
    setLoadError(false);
    announcementService.get(id)
      .then((res) => {
        const a = res.data?.data;
        setForm({
          title: a.title || '',
          body: a.body || '',
          priority: a.priority || 'NORMAL',
          show_in_marquee: Boolean(a.show_in_marquee),
          marquee_starts_at: toLocalInputValue(a.marquee_starts_at),
          marquee_ends_at: toLocalInputValue(a.marquee_ends_at),
        });
        setStatus(a.status || 'DRAFT');
        setPushNotify(a.push_notify !== false);
        setAudienceTargets((a.audienceRules || []).map((rule) => ({
          scope_type: rule.target_scope_type,
          scope_id: rule.target_scope_id,
          scope_label: rule.scope_label,
        })));
      })
      .catch((err) => {
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setLoadError(true);
        if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to load announcement'), 'error');
      })
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => {
    if (lockAudience && !loading) setAudienceTargets(lockedTargets);
  }, [lockAudience, lockedTargets, loading]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const buildUpdatePayload = () => ({
    title: form.title,
    body: form.body,
    priority: form.priority || 'NORMAL',
    show_in_marquee: Boolean(form.show_in_marquee),
    marquee_starts_at: fromLocalInputValue(form.marquee_starts_at),
    marquee_ends_at: fromLocalInputValue(form.marquee_ends_at),
    scope_type: owningScope.scope_type,
    scope_id: owningScope.scope_id,
    audience_targets: audienceTargets.map((t) => ({ scope_type: t.scope_type, scope_id: t.scope_id })),
    push_notify: pushNotify,
  });

  const handleSave = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await announcementService.update(id, buildUpdatePayload());
      addToast('Announcement updated', 'success');
      navigate(`/announcements/${id}`);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to update'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSchedule = async ({ iso }) => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setScheduling(true);
    try {
      await announcementService.update(id, buildUpdatePayload());
      await announcementService.schedule(id, { scheduled_at: iso });
      addToast(`Announcement scheduled for ${new Date(iso).toLocaleString()}`, 'success');
      navigate(`/announcements/${id}`);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to schedule'), 'error');
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  const handleSaveAndPublish = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setPublishing(true);
    try {
      await announcementService.update(id, buildUpdatePayload());
      await announcementService.publish(id, { push_notify: pushNotify });
      addToast(pushNotify ? 'Announcement published — employees notified' : 'Announcement published', 'success');
      navigate(`/announcements/${id}`);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to publish'), 'error');
    } finally {
      setPublishing(false);
    }
  };

  if (!canEdit) return <Navigate to={`/announcements/${id}`} replace />;
  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Edit announcement"
        title="Announcement not found"
        description="This announcement does not exist or is no longer available."
        backTo="/announcements"
        backLabel="Back to announcements"
      />
    );
  }
  if (loadError) {
    return (
      <NotFoundState
        pageTitle="Edit announcement"
        title="Unable to load announcement"
        description="Something went wrong while loading this announcement."
        backTo="/announcements"
        backLabel="Back to announcements"
      />
    );
  }

  return (
    <div>
      <PageHeader title="Edit Announcement" backTo={`/announcements/${id}`} />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Body <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={form.body}
            onChange={(html) => setForm((p) => ({ ...p, body: html }))}
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

          {form.show_in_marquee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <Input
                label="Marquee starts at"
                name="marquee_starts_at"
                type="datetime-local"
                value={form.marquee_starts_at}
                onChange={handleChange}
              />
              <Input
                label="Marquee ends at"
                name="marquee_ends_at"
                type="datetime-local"
                value={form.marquee_ends_at}
                onChange={handleChange}
              />
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lockAudience
                ? 'Audience is locked to your assigned scope.'
                : 'Update the organisation scopes that should receive this announcement when it is published.'}
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
                <span className="font-medium text-gray-700">Push notify employees in real-time on publish</span>
                <span className="block text-xs text-gray-500">
                  Sends an instant in-app notification to the audience when this announcement is published. Uncheck to publish silently.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="ghost" onClick={() => navigate(`/announcements/${id}`)}>Cancel</Button>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={publishing || scheduling}>Save Changes</Button>
          {canPublish && status === 'DRAFT' && (
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
