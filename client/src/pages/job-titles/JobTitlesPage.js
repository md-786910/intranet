import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { jobTitleService } from '../../services/jobTitleService';
import { useToast } from '../../hooks/useToast';
import { getUserFacingMessage } from '../../utils/errorUtils';
import { formatJobTitleName } from '../../utils/jobTitleFormat';

export default function JobTitlesPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await jobTitleService.list();
      setItems(res.data?.data || []);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to load job titles'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = formatJobTitleName(newName);
    if (!name) {
      addToast('Name is required', 'error');
      return;
    }
    setAdding(true);
    try {
      await jobTitleService.create({ name });
      setNewName('');
      await load();
      addToast('Job title added', 'success');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to add'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditName(item.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
  };

  const saveEdit = async (id) => {
    const name = formatJobTitleName(editName);
    if (!name) {
      addToast('Name is required', 'error');
      return;
    }
    setSavingId(id);
    try {
      await jobTitleService.update(id, { name });
      cancelEdit();
      await load();
      addToast('Saved', 'success');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to save'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await jobTitleService.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
      addToast('Deleted', 'success');
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to delete'), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Job Titles"
        subtitle="Manage the list of job titles available when creating or editing users."
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/40">
          <label htmlFor="newName" className="block text-sm font-medium text-gray-700 mb-1">
            New job title
          </label>
          <div className="flex items-center gap-3">
            <input
              id="newName"
              name="newName"
              type="text"
              placeholder="e.g. Senior Engineer"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => setNewName((v) => formatJobTitleName(v) || v)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <Button onClick={handleAdd} loading={adding} className="shrink-0">
              Add
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Saved as Title Case (e.g. Team Lead).</p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3 w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-500">
                No job titles yet. Add one above to get started.
              </td></tr>
            )}
            {items.map((item) => {
              const isEditing = editId === item.id;
              return (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3 align-middle">
                    {isEditing ? (
                      <Input
                        name="editName"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => setEditName((v) => formatJobTitleName(v) || v)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right align-middle">
                    {isEditing ? (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                        <Button size="sm" loading={savingId === item.id} onClick={() => saveEdit(item.id)}>Save</Button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(item)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(item)}>Delete</Button>
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
            <h3 className="text-lg font-semibold text-gray-900">Delete job title?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will remove <strong>{confirmDelete.name}</strong> from the list.
              Users whose profile already has this title will keep it as-is.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
