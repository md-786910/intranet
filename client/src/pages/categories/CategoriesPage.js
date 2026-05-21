import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CategoryFormModal from '../../components/categories/CategoryFormModal';
import ActivityModal from '../../components/common/ActivityModal';
import { categoryService } from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { categoryEvents } from '../../utils/activityEvents';

function nameOf(user) {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (user.email || null);
}

// Pick the most recent action to surface as a secondary line under the
// creator name. Categories have no publish state, so we show updates and
// deletions only.
function latestAction(cat) {
  if (cat.deleted_at && cat.deleter) {
    return { label: 'Deleted', actor: cat.deleter, at: cat.deleted_at };
  }
  if (cat.updater && cat.updated_at && cat.updated_at !== cat.created_at) {
    return { label: 'Updated', actor: cat.updater, at: cat.updated_at };
  }
  return null;
}

const TABS = [
  { value: 'NEWS', label: 'News' },
  { value: 'DOCUMENT', label: 'Documents' },
];

export default function CategoriesPage() {
  const { addToast } = useToast();
  const { hasPermission: canEditNews } = usePermission('NEWS', 'EDIT');
  const { hasPermission: canEditDocs } = usePermission('DOCUMENTS', 'EDIT');
  const { hasPermission: canDeleteNews } = usePermission('NEWS', 'DELETE');
  const { hasPermission: canDeleteDocs } = usePermission('DOCUMENTS', 'DELETE');
  const { isOwner } = useAuth();

  const allowedTabs = useMemo(() => {
    return TABS.filter((t) => (t.value === 'NEWS' ? canEditNews : canEditDocs));
  }, [canEditNews, canEditDocs]);

  const [entityType, setEntityType] = useState(() => allowedTabs[0]?.value || 'DOCUMENT');
  const [viewMode, setViewMode] = useState('active');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ categories: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [confirmCategory, setConfirmCategory] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(null); // { mode: 'create' | 'edit', initial }
  const [activityCategory, setActivityCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]); // for parent dropdown
  const { page, limit, setPage, setLimit } = usePagination();
  const skipFetchRef = useRef(false);

  const isTrash = viewMode === 'trash';

  const canDeleteCurrent = entityType === 'NEWS' ? canDeleteNews : canDeleteDocs;

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = { entity_type: entityType, page, limit };
      if (search) params.search = search;
      if (isTrash) params.trash = true;
      const res = await categoryService.list(params);
      setData(res.data?.data || { categories: [], pagination: {} });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [entityType, page, limit, search, isTrash, addToast]);

  const fetchAllForParentPicker = useCallback(async () => {
    try {
      const res = await categoryService.list({ entity_type: entityType, limit: 200 });
      setAllCategories(res.data?.data?.categories || []);
    } catch {
      // non-fatal — parent dropdown will just be empty
      setAllCategories([]);
    }
  }, [entityType]);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!isTrash) fetchAllForParentPicker();
  }, [fetchAllForParentPicker, isTrash]);

  const switchTab = (next) => {
    if (next === entityType) return;
    setEntityType(next);
    setViewMode('active');
    setSearch('');
    setPage(1);
  };

  const toggleTrash = () => {
    setViewMode((m) => (m === 'trash' ? 'active' : 'trash'));
    setPage(1);
  };

  const handleSaved = () => {
    setEditing(null);
    fetchCategories();
    fetchAllForParentPicker();
    addToast('Category saved', 'success');
  };

  const handleConfirmDelete = async () => {
    if (!confirmCategory) return;
    setActionLoading(true);
    try {
      await categoryService.remove(confirmCategory.category_id);
      addToast(`"${confirmCategory.name}" moved to trash`, 'success');
      setConfirmCategory(null);
      fetchCategories();
      fetchAllForParentPicker();
    } catch (err) {
      addToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (category) => {
    setActionLoading(true);
    try {
      await categoryService.bulkRestore([category.category_id]);
      addToast(`"${category.name}" restored`, 'success');
      fetchCategories();
      fetchAllForParentPicker();
    } catch (err) {
      addToast(err.response?.data?.message || 'Restore failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (allowedTabs.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (!allowedTabs.find((t) => t.value === entityType)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <PageHeader
        title={isTrash ? 'Categories — Trash' : 'Categories'}
        subtitle={
          isTrash
            ? 'Deleted categories can be restored from here'
            : isOwner
              ? 'Manage categories used by News and Documents'
              : 'Showing categories at your scope. Platform Owner can see all.'
        }
        actions={
          <div className="flex gap-2">
            {!isTrash && (
              <Button onClick={() => setEditing({ mode: 'create', initial: null })}>
                New category
              </Button>
            )}
            <Button
              variant={isTrash ? 'primary' : 'secondary'}
              onClick={toggleTrash}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
            >
              {isTrash ? 'Back to categories' : 'Trash'}
            </Button>
          </div>
        }
      />

      {allowedTabs.length > 1 && (
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex gap-6">
            {allowedTabs.map((tab) => {
              const active = tab.value === entityType;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => switchTab(tab.value)}
                  className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    active
                      ? 'text-primary-700 border-primary-600'
                      : 'text-gray-500 border-transparent hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-72">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name..." />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="px-4 py-3 font-medium text-gray-600">Parent</th>
                <th className="px-4 py-3 font-medium text-gray-600">Author</th>
                <th className="px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 font-medium text-gray-600">{isTrash ? 'Deleted' : 'Updated'}</th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="animate-pulse space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-6 bg-gray-100 rounded" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : data.categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    {isTrash
                      ? (search ? 'No deleted categories match the filter' : 'Trash is empty')
                      : (search ? 'No categories match the filter' : 'No categories yet — create one to get started')}
                  </td>
                </tr>
              ) : (
                data.categories.map((cat) => (
                  <tr key={cat.category_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{cat.name}</span>
                      {cat.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{cat.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-mono">
                        {cat.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cat.parent ? cat.parent.name : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 leading-tight">
                      <div className="text-gray-700">{nameOf(cat.creator) || <span className="text-gray-400">—</span>}</div>
                      {(() => {
                        const action = latestAction(cat);
                        if (!action) return null;
                        return (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {action.label} by {nameOf(action.actor) || 'someone'} · {formatRelativeTime(action.at)}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cat.item_count}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(isTrash ? cat.deleted_at : cat.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActivityCategory(cat)}
                          className="text-gray-400 hover:text-gray-700"
                          title="Activity"
                          aria-label="View activity"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {isTrash ? (
                          canDeleteCurrent && (
                            <button
                              type="button"
                              onClick={() => handleRestore(cat)}
                              disabled={actionLoading}
                              className="text-primary-600 hover:text-primary-700 text-xs font-medium disabled:opacity-50"
                            >
                              Restore
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing({ mode: 'edit', initial: cat })}
                              className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                            >
                              Edit
                            </button>
                            {canDeleteCurrent && (
                              <button
                                type="button"
                                onClick={() => setConfirmCategory(cat)}
                                className="text-red-600 hover:text-red-700 text-xs font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <CategoryFormModal
        isOpen={Boolean(editing)}
        mode={editing?.mode || 'create'}
        entityType={entityType}
        initial={editing?.initial}
        parentOptions={allCategories}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmCategory)}
        onCancel={() => setConfirmCategory(null)}
        onConfirm={handleConfirmDelete}
        loading={actionLoading}
        title="Move to trash"
        message={
          confirmCategory
            ? `Move "${confirmCategory.name}" to Trash? You can restore it later from the Trash tab.${
                confirmCategory.item_count > 0
                  ? ` Note: ${confirmCategory.item_count} item${confirmCategory.item_count === 1 ? ' uses' : 's use'} this category.`
                  : ''
              }`
            : ''
        }
        confirmLabel="Move to trash"
      />

      <ActivityModal
        isOpen={Boolean(activityCategory)}
        onClose={() => setActivityCategory(null)}
        title={activityCategory ? `Activity · ${activityCategory.name}` : 'Activity'}
        events={categoryEvents(activityCategory)}
      />
    </div>
  );
}
