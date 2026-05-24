import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import Select from '../../components/common/Select';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MediaGallery from '../../components/common/MediaGallery';
import FileDropzone from '../../components/common/FileDropzone';
import MediaPreviewDrawer from '../../components/common/MediaPreviewDrawer';
import { mediaService } from '../../services/mediaService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { useMultiUpload } from '../../hooks/useMultiUpload';
import { formatFileSize } from '../../utils/formatters';

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'image/', label: 'Images' },
  { value: 'application/', label: 'Documents' },
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_BULK_DELETE = 10;

export default function MediaGalleryPage() {
  const { addToast } = useToast();
  const { hasPermission: canCreateDocs } = usePermission('DOCUMENTS', 'CREATE');
  const { hasPermission: canCreateNews } = usePermission('NEWS', 'CREATE');
  const { hasPermission: canDeleteDocs } = usePermission('DOCUMENTS', 'DELETE');
  const { hasPermission: canDeleteNews } = usePermission('NEWS', 'DELETE');
  const { isOwner } = useAuth();
  const canAccess = canCreateDocs || canCreateNews;
  const canDelete = canDeleteDocs || canDeleteNews;

  const { page, limit, setPage, setLimit } = usePagination();
  const [viewMode, setViewMode] = useState('active');
  const [search, setSearch] = useState('');
  const [mimePrefix, setMimePrefix] = useState('');
  const [data, setData] = useState({ assets: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmIds, setConfirmIds] = useState(null);
  const [purgeIds, setPurgeIds] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);
  const headerInputRef = useRef(null);
  const clearTimerRef = useRef(null);
  const limitWarnedRef = useRef(false);

  const isTrash = viewMode === 'trash';

  const fetchAssets = useCallback(async () => {
    if (!canAccess) return;
    try {
      setLoading(true);
      const params = { page, limit };
      if (search) params.search = search;
      if (mimePrefix) params.mime_prefix = mimePrefix;
      if (isTrash) params.trash = true;
      const res = await mediaService.list(params);
      setData(res.data?.data || { assets: [], pagination: {} });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load media', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, mimePrefix, isTrash, addToast, canAccess]);

  const uploader = useMultiUpload({
    concurrency: 3,
    onComplete: ({ succeeded, failed }) => {
      const okCount = succeeded.length;
      const failCount = failed.length;
      if (okCount > 0 && failCount === 0) {
        addToast(`Uploaded ${okCount} file${okCount === 1 ? '' : 's'}`, 'success');
      } else if (okCount > 0 && failCount > 0) {
        addToast(`Uploaded ${okCount} of ${okCount + failCount} files`, 'warning');
      } else if (failCount > 0) {
        addToast(`Failed to upload ${failCount} file${failCount === 1 ? '' : 's'}`, 'error');
      }
      if (okCount > 0) {
        if (page !== 1) setPage(1);
        else fetchAssets();
      }
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        uploader.clear();
        clearTimerRef.current = null;
      }, 2500);
    },
  });

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => { setSelectedIds([]); }, [page, search, mimePrefix, viewMode]);

  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, []);

  const handleSelectionChange = useCallback((nextIds) => {
    if (nextIds.length > MAX_BULK_DELETE) {
      setSelectedIds(nextIds.slice(0, MAX_BULK_DELETE));
      if (!limitWarnedRef.current) {
        addToast(`You can select up to ${MAX_BULK_DELETE} items at a time`, 'warning');
        limitWarnedRef.current = true;
        setTimeout(() => { limitWarnedRef.current = false; }, 4000);
      }
    } else {
      setSelectedIds(nextIds);
    }
  }, [addToast]);

  const handleRejected = (rejected) => {
    rejected.forEach((r) => addToast(r.message, 'error'));
  };

  const handleHeaderUploadClick = () => headerInputRef.current?.click();

  const handleHeaderInputChange = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    const accepted = [];
    const rejected = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push({ message: `${file.name} exceeds the 10 MB limit` });
      } else {
        accepted.push(file);
      }
    }
    if (rejected.length > 0) handleRejected(rejected);
    if (accepted.length > 0) uploader.start(accepted);
  };

  const handleConfirmDelete = async () => {
    if (!confirmIds || confirmIds.length === 0) return;
    setActionLoading(true);
    try {
      await mediaService.bulkDelete(confirmIds);
      addToast(`Moved ${confirmIds.length} item${confirmIds.length === 1 ? '' : 's'} to trash`, 'success');
      setSelectedIds((prev) => prev.filter((id) => !confirmIds.includes(id)));
      setConfirmIds(null);
      fetchAssets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (ids) => {
    if (!ids || ids.length === 0) return;
    setActionLoading(true);
    try {
      await mediaService.bulkRestore(ids);
      addToast(`Restored ${ids.length} item${ids.length === 1 ? '' : 's'}`, 'success');
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setPreviewAsset(null);
      fetchAssets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Restore failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeIds || purgeIds.length === 0) return;
    setActionLoading(true);
    try {
      await mediaService.bulkPurge(purgeIds);
      addToast(`Permanently deleted ${purgeIds.length} item${purgeIds.length === 1 ? '' : 's'}`, 'success');
      setSelectedIds((prev) => prev.filter((id) => !purgeIds.includes(id)));
      setPreviewAsset(null);
      setPurgeIds(null);
      fetchAssets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Permanent delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleViewMode = () => {
    setViewMode((m) => (m === 'trash' ? 'active' : 'trash'));
    setPage(1);
    setPreviewAsset(null);
  };

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const selectionCount = selectedIds.length;

  return (
    <div>
      <PageHeader
        title={isTrash ? 'Media — Trash' : 'Media'}
        subtitle={
          isTrash
            ? 'Deleted items can be restored from here'
            : isOwner
              ? 'All uploaded files and images'
              : 'Showing uploads at your scope. Platform Owner can see all.'
        }
        actions={
          <div className="flex gap-2">
            <input
              ref={headerInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleHeaderInputChange}
            />
            {!isTrash && (
              <Button onClick={handleHeaderUploadClick} loading={uploader.isUploading}>Upload</Button>
            )}
            <Button
              variant={isTrash ? 'primary' : 'secondary'}
              onClick={toggleViewMode}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
            >
              {isTrash ? 'Back to media' : 'Trash'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-72">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name..." />
        </div>
        <div className="w-44">
          <Select
            name="mime_prefix"
            value={mimePrefix}
            onChange={(e) => setMimePrefix(e.target.value)}
            options={TYPE_FILTERS}
          />
        </div>
        {canDelete && selectionCount > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {selectionCount} of {MAX_BULK_DELETE} selected
            </span>
            {isTrash ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  loading={actionLoading}
                  onClick={() => handleRestore(selectedIds)}
                >
                  Restore selected
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPurgeIds(selectedIds)}
                >
                  Delete forever
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmIds(selectedIds)}
              >
                Move to trash
              </Button>
            )}
          </div>
        )}
      </div>

      {!isTrash && (
        <div className="mb-4">
          <FileDropzone
            multiple
            maxSizeBytes={MAX_UPLOAD_BYTES}
            onFiles={uploader.start}
            onRejected={handleRejected}
            hint="Images (JPG, PNG, GIF, WEBP, SVG), PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP, RAR, 7z — up to 10 MB each"
          />
        </div>
      )}

      {!isTrash && uploader.items.length > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {uploader.items.map((item) => (
            <UploadRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <MediaGallery
        assets={data.assets}
        loading={loading}
        selectionMode={canDelete ? 'multi' : 'none'}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        onDelete={canDelete && !isTrash ? (ids) => setConfirmIds(ids) : undefined}
        onRestore={canDelete && isTrash ? (ids) => handleRestore(ids) : undefined}
        onPurge={canDelete && isTrash ? (ids) => setPurgeIds(ids) : undefined}
        onRowClick={(asset) => setPreviewAsset(asset)}
        selectionLimit={MAX_BULK_DELETE}
        emptyMessage={
          isTrash
            ? (search || mimePrefix ? 'No deleted items match the filter' : 'Trash is empty')
            : (search || mimePrefix ? 'No media match the filter' : 'No media yet — upload one to get started')
        }
      />

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={data.pagination.limit}
        onPageChange={setPage}
        onLimitChange={(val) => { setLimit(val); setPage(1); }}
      />

      <ConfirmDialog
        isOpen={Boolean(purgeIds)}
        onCancel={() => setPurgeIds(null)}
        onConfirm={handleConfirmPurge}
        loading={actionLoading}
        title="Delete forever"
        message={
          purgeIds && purgeIds.length === 1
            ? 'Permanently delete this file? It will be removed from disk and cannot be restored.'
            : `Permanently delete ${purgeIds?.length || 0} files? They will be removed from disk and cannot be restored.`
        }
        confirmLabel="Delete forever"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={Boolean(confirmIds)}
        onCancel={() => setConfirmIds(null)}
        onConfirm={handleConfirmDelete}
        loading={actionLoading}
        title="Move to trash"
        message={
          confirmIds && confirmIds.length === 1
            ? 'Move this file to Trash? You can restore it later from the Trash tab.'
            : `Move ${confirmIds?.length || 0} files to Trash? You can restore them later from the Trash tab.`
        }
        confirmLabel="Move to trash"
      />

      <MediaPreviewDrawer
        asset={previewAsset}
        open={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        canDelete={canDelete && !isTrash}
        canRestore={canDelete && isTrash}
        onDelete={(asset) => {
          setPreviewAsset(null);
          setConfirmIds([asset.media_asset_id]);
        }}
        onRestore={(asset) => handleRestore([asset.media_asset_id])}
      />
    </div>
  );
}

function UploadRow({ item }) {
  const isError = item.status === 'error';
  const isDone = item.status === 'done';
  const isUploading = item.status === 'uploading';
  const barColor = isError ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-primary-500';
  const widthPct = isError ? 100 : item.progress;

  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-medium text-gray-900" title={item.name}>{item.name}</div>
          <div className="flex-shrink-0 text-xs text-gray-500">{formatFileSize(item.size)}</div>
        </div>
        <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${widthPct}%` }} />
        </div>
        {isError && (
          <div className="mt-1 text-xs text-red-600" title={item.error}>{item.error}</div>
        )}
      </div>
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        {isDone && (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
        {isError && (
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {isUploading && (
          <svg className="w-4 h-4 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    </div>
  );
}
