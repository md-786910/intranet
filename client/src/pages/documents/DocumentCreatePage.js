import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';

const DEFAULT_ORG_UNIT_ID = 1;

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', summary: '', category_id: '', file_url: '', file_name: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    documentService.getCategories({ org_unit_id: DEFAULT_ORG_UNIT_ID })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.title.trim() || !form.file_url.trim() || !form.file_name.trim()) {
      addToast('Title, file URL, and file name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await documentService.createDocument({
        ...form,
        category_id: form.category_id || undefined,
        owning_org_unit_id: DEFAULT_ORG_UNIT_ID,
      });
      addToast('Document created', 'success');
      navigate('/documents');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create document', 'error');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Document</Button>
        </div>
      </div>
    </div>
  );
}
