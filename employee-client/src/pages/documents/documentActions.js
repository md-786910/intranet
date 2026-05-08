// File URLs returned by the server are relative paths like `/uploads/...`.
// They're served by the API host (e.g. localhost:8000), not the React dev
// host (3001), so `<img src>` / `<iframe src>` need an absolute URL.
export function resolveFileUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  const host = apiBase.replace(/\/api\/v\d+\/?$/, '');
  return host + (url.startsWith('/') ? url : `/${url}`);
}

export function formatBytes(n) {
  if (n == null || isNaN(n)) return '—';
  const bytes = Number(n);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Pull primary file fields off the document's latest version. The list /
// recently-viewed / featured endpoints all return one version preloaded.
// Short uppercase type label for table columns (e.g. "PDF", "PNG", "DOCX").
// Falls back to the mime subtype if the extension is missing or absurd.
export function typeLabelFor(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toUpperCase();
  if (ext && ext.length <= 5 && /^[A-Z0-9]+$/.test(ext)) return ext;
  const sub = (mime || '').split('/').pop();
  return sub ? sub.toUpperCase().slice(0, 5) : 'FILE';
}

export function pickPrimaryFile(doc = {}) {
  const v0 = doc.versions?.[0] || null;
  if (v0) {
    return {
      name: v0.file_name,
      mime: v0.mime_type,
      size: v0.file_size,
      url: resolveFileUrl(v0.file_url),
    };
  }
  return { name: doc.title, mime: '', size: null, url: null };
}

// File-type chip definitions for the filter popover. `mimePrefixes` are sent
// to the API; the icon/label drive the chip UI.
export const FILE_TYPE_CHIPS = [
  { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', mimePrefixes: ['application/pdf'] },
  { id: 'image', label: 'Image', icon: 'image', mimePrefixes: ['image/'] },
  { id: 'doc', label: 'Doc', icon: 'description', mimePrefixes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'] },
  { id: 'spreadsheet', label: 'Sheet', icon: 'table_view', mimePrefixes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml', 'text/csv'] },
  { id: 'slides', label: 'Slides', icon: 'slideshow', mimePrefixes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'] },
  { id: 'video', label: 'Video', icon: 'video_library', mimePrefixes: ['video/'] },
  { id: 'archive', label: 'Archive', icon: 'folder_zip', mimePrefixes: ['application/zip', 'application/x-rar', 'application/x-7z', 'application/x-tar'] },
];

export const PRIORITY_CHIPS = [
  { id: 'URGENT', label: 'Urgent', color: 'bg-error-container text-on-error-container' },
  { id: 'HIGH', label: 'High', color: 'bg-tertiary-fixed text-on-tertiary-container' },
  { id: 'NORMAL', label: 'Normal', color: 'bg-secondary-fixed text-on-secondary-container' },
  { id: 'LOW', label: 'Low', color: 'bg-surface-container-high text-on-surface-variant' },
];

export function mimePrefixesForFileTypes(fileTypeIds = []) {
  const prefixes = [];
  for (const id of fileTypeIds) {
    const chip = FILE_TYPE_CHIPS.find((c) => c.id === id);
    if (chip) prefixes.push(...chip.mimePrefixes);
  }
  return prefixes;
}
