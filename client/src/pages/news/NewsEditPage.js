import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';

const DEFAULT_ORG_UNIT_ID = 1;

export default function NewsEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({ title: '', summary: '', body: '', cover_image_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    newsService.getArticle(id, { org_unit_id: DEFAULT_ORG_UNIT_ID })
      .then((res) => {
        const a = res.data?.data;
        setForm({ title: a.title, summary: a.summary || '', body: a.body || '', cover_image_url: a.cover_image_url || '' });
      })
      .catch(() => addToast('Failed to load article', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await newsService.updateArticle(id, { ...form, org_unit_id: DEFAULT_ORG_UNIT_ID });
      addToast('Article updated', 'success');
      navigate(`/news/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;

  return (
    <div>
      <PageHeader title="Edit Article" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-4">
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />
        <Input label="Summary" name="summary" value={form.summary} onChange={handleChange} />
        <Textarea label="Body" name="body" required value={form.body} onChange={handleChange} rows={12} />
        <Input label="Cover Image URL" name="cover_image_url" value={form.cover_image_url} onChange={handleChange} />
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate(`/news/${id}`)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
