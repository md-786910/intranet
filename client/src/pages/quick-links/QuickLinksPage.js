import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { quickLinkService } from '../../services/quickLinkService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errorUtils';

const URL_PATTERN = /^(https?:\/\/|\/).+/i;

export default function QuickLinksPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await quickLinkService.list();
      setItems(res.data?.data || []);
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to load quick links'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    const label = newLabel.trim();
    const url = newUrl.trim();
    if (!label) {
      addToast('Label is required', 'error');
      return;
    }
    if (!URL_PATTERN.test(url)) {
      addToast('URL must start with http://, https://, or "/"', 'error');
      return;
    }
    setAdding(true);
    try {
      await quickLinkService.create({ label, url });
      setNewLabel('');
      setNewUrl('');
      await load();
      addToast('Quick link added', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to add'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item) => {
    setEditId(item.quick_link_id);
    setEditLabel(item.label);
    setEditUrl(item.url);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditLabel('');
    setEditUrl('');
  };

  const saveEdit = async (id) => {
    const label = editLabel.trim();
    const url = editUrl.trim();
    if (!label) {
      addToast('Label is required', 'error');
      return;
    }
    if (!URL_PATTERN.test(url)) {
      addToast('URL must start with http://, https://, or "/"', 'error');
      return;
    }
    setSavingId(id);
    try {
      await quickLinkService.update(id, { label, url });
      cancelEdit();
      await load();
      addToast('Saved', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to save'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await quickLinkService.remove(confirmDelete.quick_link_id);
      setConfirmDelete(null);
      await load();
      addToast('Deleted', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to delete'), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Quick Links"
        subtitle="Curate the shortcut tiles employees see on their home page. Use full URLs (https://…) for external sites or paths starting with “/” for in-app routes."
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/40">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4">
              <Input
                label="Label"
                name="newLabel"
                placeholder="e.g. Company Calendar"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="col-span-6">
              <Input
                label="URL"
                name="newUrl"
                placeholder="https://… or /people"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Button onClick={handleAdd} loading={adding} className="w-full">
                Add
              </Button>
            </div>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-6 py-3">Label</th>
              <th className="px-6 py-3">URL</th>
              <th className="px-6 py-3 w-56 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                  No quick links yet. Add one above to get started.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const isEditing = editId === item.quick_link_id;
              return (
                <tr key={item.quick_link_id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3 align-middle">
                    {isEditing ? (
                      <Input
                        name="editLabel"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 align-middle">
                    {isEditing ? (
                      <Input
                        name="editUrl"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                      />
                    ) : (
                      <a
                        href={item.url}
                        target={/^https?:\/\//i.test(item.url) ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="text-sm text-primary-700 hover:underline break-all"
                      >
                        {item.url}
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right align-middle">
                    {isEditing ? (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={cancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          loading={savingId === item.quick_link_id}
                          onClick={() => saveEdit(item.quick_link_id)}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(item)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete quick link?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will remove <strong>{confirmDelete.label}</strong> from the employee home page.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
