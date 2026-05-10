import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { roleCategoryService } from '../../services/roleCategoryService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errorUtils';

export default function RoleCategoriesPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await roleCategoryService.list();
      setItems(res.data?.data || []);
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to load role categories'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      addToast('Name is required', 'error');
      return;
    }
    setAdding(true);
    try {
      await roleCategoryService.create({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName('');
      setNewDesc('');
      await load();
      addToast('Role category added', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to add'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditDesc(item.description || '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditDesc('');
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) {
      addToast('Name is required', 'error');
      return;
    }
    setSavingId(id);
    try {
      await roleCategoryService.update(id, { name: editName.trim(), description: editDesc.trim() || null });
      cancelEdit();
      await load();
      addToast('Saved', 'success');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to save'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const nextOrder = items.slice();
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    const ids = nextOrder.map((c) => c.id);
    setItems(nextOrder.map((c, i) => ({ ...c, rank: i + 1 })));
    try {
      await roleCategoryService.reorder(ids);
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to reorder'), 'error');
      await load();
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await roleCategoryService.remove(confirmDelete.id);
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
        title="Role Categories"
        subtitle="Define the hierarchy levels (CEO, VP, Director, …). Order is used to render the org chart."
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/40">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4">
              <Input
                label="New role category"
                name="newName"
                placeholder="e.g. Senior Manager"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="col-span-6">
              <Input
                label="Description"
                name="newDesc"
                placeholder="Optional"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Button onClick={handleAdd} loading={adding} className="w-full">Add</Button>
            </div>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-6 py-3 w-24">Order</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3 w-56 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                No role categories yet. Add one above to get started.
              </td></tr>
            )}
            {items.map((item, idx) => {
              const isEditing = editId === item.id;
              return (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-mono font-semibold">
                        #{item.rank}
                      </span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label="Move up"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                        >▲</button>
                        <button
                          type="button"
                          aria-label="Move down"
                          onClick={() => move(idx, 1)}
                          disabled={idx === items.length - 1}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                        >▼</button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 align-middle">
                    {isEditing ? (
                      <Input name="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 align-middle">
                    {isEditing ? (
                      <Input name="editDesc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    ) : (
                      <span className="text-sm text-gray-600">{item.description || <span className="text-gray-400">—</span>}</span>
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
            <h3 className="text-lg font-semibold text-gray-900">Delete role category?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will remove <strong>{confirmDelete.name}</strong>. Employees currently assigned to it will block deletion.
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
