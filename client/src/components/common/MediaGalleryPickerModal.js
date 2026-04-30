import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import SearchBar from './SearchBar';
import Select from './Select';
import Pagination from './Pagination';
import MediaGallery from './MediaGallery';
import { mediaService } from '../../services/mediaService';
import { useToast } from '../../hooks/useToast';

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'image/', label: 'Images' },
  { value: 'application/', label: 'Documents' },
];

function inferMimePrefix(accept) {
  if (!accept) return '';
  if (accept.startsWith('image/')) return 'image/';
  if (accept.startsWith('application/')) return 'application/';
  return '';
}

export default function MediaGalleryPickerModal({
  isOpen,
  onClose,
  mode = 'single',
  accept,
  context,
  onConfirm,
  initialSelectedIds = [],
}) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [mimePrefix, setMimePrefix] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ assets: [], pagination: {} });
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const acceptInferred = useMemo(() => inferMimePrefix(accept), [accept]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(initialSelectedIds);
    setSearch('');
    setMimePrefix(acceptInferred);
    setPage(1);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssets = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (mimePrefix) params.mime_prefix = mimePrefix;
      const res = await mediaService.list(params);
      setData(res.data?.data || { assets: [], pagination: {} });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load media', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, search, mimePrefix, addToast]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast('File exceeds the 10 MB limit', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await mediaService.upload(file, undefined, { context });
      const asset = res.data?.data;
      addToast('Uploaded', 'success');
      // Refresh and pre-select the new asset
      if (page !== 1) setPage(1);
      else fetchAssets();
      if (asset?.media_asset_id) {
        setSelectedIds(mode === 'single' ? [asset.media_asset_id] : (prev) => [...prev, asset.media_asset_id]);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    // selectedIds may include items selected on a previous page; only the
    // assets we currently have in memory can be returned. Refetch isn't
    // worth it — limit confirms to assets shown on the active page.
    const picked = data.assets.filter((a) => selectedIds.includes(a.media_asset_id));
    if (picked.length === 0) {
      addToast('Pick at least one item', 'warning');
      return;
    }
    onConfirm?.(mode === 'single' ? picked[0] : picked);
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose from media library"
      size="3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>
            {mode === 'single' ? 'Use selected' : `Use selected (${selectedIds.length})`}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex-1 min-w-[12rem]">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name..." />
        </div>
        <div className="w-44">
          <Select
            name="mime_prefix"
            value={mimePrefix}
            onChange={(e) => { setMimePrefix(e.target.value); setPage(1); }}
            options={TYPE_FILTERS}
          />
        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} accept={accept} />
        <Button variant="secondary" onClick={handleUploadClick} loading={uploading}>Upload new</Button>
      </div>

      <MediaGallery
        assets={data.assets}
        loading={loading}
        selectionMode={mode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage={search || mimePrefix ? 'No media match the filter' : 'Upload a file to get started'}
      />

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={data.pagination.limit}
        onPageChange={setPage}
      />
    </Modal>
  );
}
