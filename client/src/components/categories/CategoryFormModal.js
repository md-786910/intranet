import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import { categoryService } from '../../services/categoryService';

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 290);
}

function buildDescendantSet(categories, rootId) {
  // Returns a Set of category_ids that are rootId or any descendant of it.
  const set = new Set();
  if (rootId == null) return set;
  set.add(rootId);
  const byParent = new Map();
  categories.forEach((c) => {
    const arr = byParent.get(c.parent_category_id) || [];
    arr.push(c);
    byParent.set(c.parent_category_id, arr);
  });
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const children = byParent.get(id) || [];
    children.forEach((c) => {
      if (!set.has(c.category_id)) {
        set.add(c.category_id);
        queue.push(c.category_id);
      }
    });
  }
  return set;
}

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  parent_category_id: '',
  sort_order: 0,
};

export default function CategoryFormModal({
  isOpen,
  mode,
  entityType,
  initial,
  parentOptions = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name || '',
        slug: initial.slug || '',
        description: initial.description || '',
        parent_category_id: initial.parent_category_id ? String(initial.parent_category_id) : '',
        sort_order: initial.sort_order ?? 0,
      });
      setSlugTouched(true);
    } else {
      setForm(EMPTY);
      setSlugTouched(false);
    }
    setErrors({});
  }, [isOpen, mode, initial]);

  const excludedIds = useMemo(() => {
    if (mode !== 'edit' || !initial) return new Set();
    return buildDescendantSet(parentOptions, initial.category_id);
  }, [mode, initial, parentOptions]);

  const parentSelectOptions = useMemo(() => {
    const options = [{ value: '', label: '— No parent —' }];
    parentOptions.forEach((c) => {
      if (excludedIds.has(c.category_id)) return;
      options.push({ value: String(c.category_id), label: c.name });
    });
    return options;
  }, [parentOptions, excludedIds]);

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
    }));
  };

  const handleSlugChange = (e) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (form.slug && !/^[a-z0-9-]+$/i.test(form.slug)) {
      nextErrors.slug = 'Use letters, numbers, and dashes only';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        parent_category_id: form.parent_category_id ? Number(form.parent_category_id) : null,
        sort_order: Number(form.sort_order) || 0,
      };
      if (mode === 'create') {
        const res = await categoryService.create({ ...payload, entity_type: entityType });
        onSaved?.(res.data?.data);
      } else {
        const res = await categoryService.update(initial.category_id, payload);
        onSaved?.(res.data?.data);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Save failed';
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors) && fieldErrors.length) {
        const map = {};
        fieldErrors.forEach((fe) => { if (fe.field) map[fe.field] = fe.message; });
        setErrors(map);
      } else {
        setErrors({ _form: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit category' : 'New category'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {mode === 'edit' ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errors._form}
          </div>
        )}
        <Input
          label="Name"
          name="name"
          value={form.name}
          onChange={handleNameChange}
          error={errors.name}
          required
          placeholder={entityType === 'NEWS' ? 'e.g. Newsletter' : 'e.g. Policies'}
        />
        <Input
          label="Slug"
          name="slug"
          value={form.slug}
          onChange={handleSlugChange}
          error={errors.slug}
          helpText="Lowercase letters, numbers, dashes. Auto-generated from name if left blank."
          placeholder="e.g. newsletter"
        />
        <Textarea
          label="Description"
          name="description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          error={errors.description}
          rows={3}
          placeholder="Optional"
        />
        <Select
          label="Parent category"
          name="parent_category_id"
          value={form.parent_category_id}
          onChange={(e) => setForm((p) => ({ ...p, parent_category_id: e.target.value }))}
          options={parentSelectOptions}
          error={errors.parent_category_id}
        />
        <Input
          label="Sort order"
          name="sort_order"
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
          error={errors.sort_order}
          helpText="Lower numbers appear first."
        />
      </form>
    </Modal>
  );
}
