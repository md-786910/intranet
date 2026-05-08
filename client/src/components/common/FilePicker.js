import React, { useState } from 'react';
import Button from './Button';
import Input from './Input';
import FileDropzone from './FileDropzone';
import MediaTypeIcon, { getMediaKind } from './MediaTypeIcon';
import MediaGalleryPickerModal from './MediaGalleryPickerModal';
import { mediaService } from '../../services/mediaService';
import { useToast } from '../../hooks/useToast';
import { resolveAssetUrl } from '../../utils/mediaUrl';
import { formatFileSize } from '../../utils/formatters';

const TABS = [
  { value: 'upload', label: 'Upload' },
  { value: 'library', label: 'Library' },
  { value: 'url', label: 'Remote URL' },
];

const ACCEPT_BY_MODE = {
  image: 'image/*',
  file: undefined,
};

function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url, window.location.origin);
    const parts = u.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || url);
  } catch {
    return url.split('/').pop() || url;
  }
}

function assetToFile(asset, source) {
  return {
    url: asset.url,
    name: asset.original_name,
    size: asset.size_bytes,
    mime: asset.mime_type,
    source: source || 'library',
  };
}

function uniqByUrl(files) {
  const seen = new Set();
  const out = [];
  for (const f of files) {
    if (f && f.url && !seen.has(f.url)) {
      seen.add(f.url);
      out.push(f);
    }
  }
  return out;
}

export default function FilePicker({
  value,
  onChange,
  mode = 'file',
  multiple = false,
  accept,
  context,
  label,
  required,
  error,
  helpText,
}) {
  const { addToast } = useToast();
  const [tab, setTab] = useState('upload');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const acceptStr = accept || ACCEPT_BY_MODE[mode];

  // Normalise value to an array internally — easier to reason about.
  const files = Array.isArray(value) ? value : (value ? [value] : []);

  const emit = (next) => {
    if (multiple) onChange(next);
    else onChange(next[0] || null);
  };

  const addFiles = (newOnes) => {
    const merged = multiple ? uniqByUrl([...files, ...newOnes]) : newOnes.slice(0, 1);
    emit(merged);
  };

  const removeAt = (idx) => {
    const next = files.filter((_, i) => i !== idx);
    emit(next);
  };

  const handleUploaded = async (chosen) => {
    if (!chosen || chosen.length === 0) return;
    setUploading(true);
    try {
      const queue = multiple ? chosen : chosen.slice(0, 1);
      const results = [];
      for (const file of queue) {
        try {
          const res = await mediaService.upload(file, undefined, { context });
          const asset = res.data?.data;
          if (asset) results.push(assetToFile(asset, 'upload'));
        } catch (err) {
          addToast(err.response?.data?.message || `Upload failed for ${file.name}`, 'error');
        }
      }
      if (results.length) addFiles(results);
    } finally {
      setUploading(false);
    }
  };

  const handleRejected = (rejected) => {
    rejected.forEach((r) => addToast(r.message, 'error'));
  };

  const handleLibraryConfirm = (asset) => {
    if (!asset) return;
    if (Array.isArray(asset)) {
      addFiles(asset.map((a) => assetToFile(a, 'library')));
    } else {
      addFiles([assetToFile(asset, 'library')]);
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    addFiles([{
      url,
      name: fileNameFromUrl(url),
      size: null,
      mime: null,
      source: 'url',
    }]);
    setUrlInput('');
  };

  const showTabs = multiple || files.length === 0;

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Attached files list (always shown when there's at least one file) */}
      {files.length > 0 && (
        <div className="space-y-2 mb-3">
          {files.map((f, idx) => (
            <FilePreviewRow
              key={`${f.url}-${idx}`}
              file={f}
              onRemove={() => removeAt(idx)}
              hasError={Boolean(error)}
            />
          ))}
        </div>
      )}

      {showTabs && (
        <div className={`rounded-xl border ${error ? 'border-red-300' : 'border-gray-200'} bg-white overflow-hidden`}>
          <div className="flex items-center gap-1 px-2 pt-2 border-b border-gray-100 bg-gray-50/60">
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? 'bg-white text-primary-700 shadow-sm border border-gray-200 border-b-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
            <div className="ml-auto pr-2 text-xs text-gray-400">
              {multiple ? `${files.length} attached` : null}
            </div>
          </div>

          <div className="p-4">
            {tab === 'upload' && (
              <FileDropzone
                multiple={multiple}
                accept={acceptStr}
                maxSizeBytes={50 * 1024 * 1024}
                onFiles={handleUploaded}
                onRejected={handleRejected}
                disabled={uploading}
                label={uploading
                  ? 'Uploading…'
                  : multiple
                    ? 'Drop files here, or click to browse'
                    : 'Drop a file here, or click to browse'}
                hint={
                  mode === 'image'
                    ? 'Images only, up to 50 MB each'
                    : 'Up to 50 MB each. PDFs, Office docs, images, video, audio, and archives are accepted.'
                }
              />
            )}

            {tab === 'library' && (
              <div className="flex items-center justify-between gap-3 px-2 py-6">
                <div>
                  <div className="text-sm font-medium text-gray-900">Pick from your media library</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {multiple
                      ? 'Reuse files someone has already uploaded — pick one or more.'
                      : 'Reuse a file someone has already uploaded.'}
                  </div>
                </div>
                <Button onClick={() => setPickerOpen(true)}>Open library</Button>
              </div>
            )}

            {tab === 'url' && (
              <div className="space-y-2">
                <Input
                  name="remote_url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/file.pdf"
                />
                <p className="text-xs text-gray-500">
                  Use this for files hosted elsewhere. The file is referenced, not copied.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                    {multiple ? 'Add URL' : 'Use this URL'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!showTabs && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => emit([])}>Replace</Button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}

      <MediaGalleryPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode={multiple ? 'multi' : 'single'}
        accept={acceptStr}
        context={context}
        onConfirm={handleLibraryConfirm}
      />
    </div>
  );
}

function FilePreviewRow({ file, onRemove, hasError }) {
  const previewUrl = file?.url ? resolveAssetUrl(file.url) : null;
  const isImage = file && getMediaKind(file.mime) === 'image';
  const sourceLabel = file?.source === 'upload'
    ? 'Uploaded'
    : file?.source === 'library'
      ? 'Library'
      : file?.source === 'url'
        ? 'Remote URL'
        : '';

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${hasError ? 'border-red-300' : 'border-gray-200'} bg-white p-3`}>
      {isImage && previewUrl ? (
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <MediaTypeIcon mime={file?.mime} size="md" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate" title={file?.name}>
          {file?.name || '(unnamed)'}
        </div>
        <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          {file?.mime && <span className="uppercase">{file.mime.split('/').pop()}</span>}
          {file?.size ? (<><span>·</span><span>{formatFileSize(file.size)}</span></>) : null}
          {sourceLabel && (<><span>·</span><span>{sourceLabel}</span></>)}
        </div>
        {file?.url && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-primary-600 hover:text-primary-700 truncate max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {file.url}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-red-600 p-1"
        title="Remove"
        aria-label="Remove"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
