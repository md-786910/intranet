import React, { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

function matchesAccept(file, accept) {
  if (!accept) return true;
  const patterns = accept.split(',').map((p) => p.trim()).filter(Boolean);
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    if (pattern.startsWith('.')) {
      return file.name.toLowerCase().endsWith(pattern.toLowerCase());
    }
    return file.type === pattern;
  });
}

export default function FileDropzone({
  onFiles,
  onRejected,
  accept,
  multiple = true,
  maxSizeBytes = DEFAULT_MAX_BYTES,
  disabled = false,
  label,
  hint,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const partition = useCallback((files) => {
    const accepted = [];
    const rejected = [];
    for (const file of files) {
      if (!matchesAccept(file, accept)) {
        rejected.push({ file, reason: 'type', message: `${file.name} is not an allowed file type` });
        continue;
      }
      if (maxSizeBytes && file.size > maxSizeBytes) {
        const limitMb = Math.round(maxSizeBytes / (1024 * 1024));
        rejected.push({ file, reason: 'size', message: `${file.name} exceeds the ${limitMb} MB limit` });
        continue;
      }
      accepted.push(file);
    }
    return { accepted, rejected };
  }, [accept, maxSizeBytes]);

  const handleFiles = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const list = multiple ? files : files.slice(0, 1);
    const { accepted, rejected } = partition(list);
    if (rejected.length > 0 && onRejected) onRejected(rejected);
    if (accepted.length > 0 && onFiles) onFiles(accepted);
  }, [multiple, partition, onFiles, onRejected]);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };

  const handleDragEnter = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDragging(true);
  };

  const handleDragOver = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    handleFiles(e.dataTransfer?.files);
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const baseClasses = 'flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-xl text-center transition-colors';
  const stateClasses = disabled
    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
    : isDragging
      ? 'border-primary-500 bg-primary-50 text-primary-700 cursor-pointer'
      : 'border-gray-300 bg-white text-gray-600 hover:border-primary-400 hover:bg-primary-50/40 cursor-pointer';

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${baseClasses} ${stateClasses} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <div className="text-sm font-medium">
        {label || (isDragging ? 'Drop to upload' : multiple ? 'Drop files here, or click to browse' : 'Drop a file here, or click to browse')}
      </div>
      {hint !== undefined ? (
        hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>
      ) : (
        <div className="text-xs text-gray-500 mt-1">
          Up to {Math.round(maxSizeBytes / (1024 * 1024))} MB per file
        </div>
      )}
    </div>
  );
}
