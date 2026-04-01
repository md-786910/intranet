import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import { pushService } from '../../services/pushService';
import { useToast } from '../../hooks/useToast';

const DEFAULT_ORG_UNIT_ID = 1;

export default function PushCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({ title: '', body: '', scheduled_at: '' });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      addToast('Title and body are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await pushService.createCampaign({
        title: form.title,
        body: form.body,
        owning_org_unit_id: DEFAULT_ORG_UNIT_ID,
        audience_org_unit_ids: [DEFAULT_ORG_UNIT_ID],
        scheduled_at: form.scheduled_at || null,
      });
      addToast('Campaign created', 'success');
      navigate('/push');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create Campaign" subtitle="Compose a push notification" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} placeholder="Notification title" />
        <Textarea label="Body" name="body" required value={form.body} onChange={handleChange} rows={4} placeholder="Notification message" />
        <Input label="Schedule (optional)" name="scheduled_at" type="datetime-local" value={form.scheduled_at} onChange={handleChange} />
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/push')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Campaign</Button>
        </div>
      </div>
    </div>
  );
}
