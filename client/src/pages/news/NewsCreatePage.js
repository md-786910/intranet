import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const DEFAULT_ORG_UNIT_ID = 1;

export default function NewsCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({ title: '', summary: '', body: '', cover_image_url: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      await newsService.createArticle({
        ...form,
        owning_org_unit_id: DEFAULT_ORG_UNIT_ID,
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
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/news')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Draft</Button>
        </div>
      </div>
    </div>
  );
}
