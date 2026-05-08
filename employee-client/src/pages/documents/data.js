// Visual theme map for category cards. Backend supplies the category data
// (id, name, description, doc_count); the frontend chooses how each one
// looks. Keyed by slug; falls back to `_default` for unknown slugs.

const FALLBACK_ICONS = ['folder', 'topic', 'inventory_2', 'description'];

export const CATEGORY_THEME = {
  policies: {
    icon: 'policy',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-fixed-dim/30',
    iconHoverBg: 'group-hover:bg-primary-fixed-dim/50',
    arrowHover: 'group-hover:text-primary',
    countText: 'text-on-primary-fixed-variant',
    countBg: 'bg-primary-fixed',
  },
  'company-policies': {
    icon: 'policy',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-fixed-dim/30',
    iconHoverBg: 'group-hover:bg-primary-fixed-dim/50',
    arrowHover: 'group-hover:text-primary',
    countText: 'text-on-primary-fixed-variant',
    countBg: 'bg-primary-fixed',
  },
  brand: {
    icon: 'palette',
    iconColor: 'text-tertiary',
    iconBg: 'bg-tertiary-fixed/30',
    iconHoverBg: 'group-hover:bg-tertiary-fixed/50',
    arrowHover: 'group-hover:text-tertiary',
    countText: 'text-on-tertiary-container',
    countBg: 'bg-tertiary-fixed',
  },
  'brand-guidelines': {
    icon: 'palette',
    iconColor: 'text-tertiary',
    iconBg: 'bg-tertiary-fixed/30',
    iconHoverBg: 'group-hover:bg-tertiary-fixed/50',
    arrowHover: 'group-hover:text-tertiary',
    countText: 'text-on-tertiary-container',
    countBg: 'bg-tertiary-fixed',
  },
  hr: {
    icon: 'assignment',
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary-fixed/30',
    iconHoverBg: 'group-hover:bg-secondary-fixed/50',
    arrowHover: 'group-hover:text-secondary',
    countText: 'text-on-secondary-container',
    countBg: 'bg-secondary-fixed',
  },
  'hr-forms': {
    icon: 'assignment',
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary-fixed/30',
    iconHoverBg: 'group-hover:bg-secondary-fixed/50',
    arrowHover: 'group-hover:text-secondary',
    countText: 'text-on-secondary-container',
    countBg: 'bg-secondary-fixed',
  },
  training: {
    icon: 'school',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-container/30',
    iconHoverBg: 'group-hover:bg-primary-container/50',
    arrowHover: 'group-hover:text-primary',
    countText: 'text-on-primary-container',
    countBg: 'bg-primary-fixed-dim',
  },
  'training-manuals': {
    icon: 'school',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-container/30',
    iconHoverBg: 'group-hover:bg-primary-container/50',
    arrowHover: 'group-hover:text-primary',
    countText: 'text-on-primary-container',
    countBg: 'bg-primary-fixed-dim',
  },
  _default: {
    iconColor: 'text-on-surface-variant',
    iconBg: 'bg-surface-container-high/40',
    iconHoverBg: 'group-hover:bg-surface-container-high/60',
    arrowHover: 'group-hover:text-on-background',
    countText: 'text-on-surface-variant',
    countBg: 'bg-surface-container-high',
  },
};

// Pick a stable visual theme for a category. Same slug → same look across
// renders; unknown slugs get a deterministic fallback icon.
export function themeForCategory(category) {
  const slug = (category?.slug || '').toLowerCase();
  const base = CATEGORY_THEME[slug] || CATEGORY_THEME._default;
  if (base.icon) return base;
  const seed = category?.category_id ?? 0;
  return { ...base, icon: FALLBACK_ICONS[Math.abs(seed) % FALLBACK_ICONS.length] };
}

// Map mime/file extension to an iconography hint for recently-viewed rows.
export function iconForFile(name = '', mime = '') {
  const lower = (name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return { icon: 'image', color: 'text-tertiary' };
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|avi)$/.test(lower)) return { icon: 'video_library', color: 'text-primary' };
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a)$/.test(lower)) return { icon: 'audio_file', color: 'text-secondary' };
  if (/\.zip$|\.rar$|\.7z$|\.tar/.test(lower)) return { icon: 'folder_zip', color: 'text-tertiary' };
  if (/\.xlsx?$|\.csv$/.test(lower)) return { icon: 'table_view', color: 'text-secondary' };
  if (/\.docx?$/.test(lower)) return { icon: 'description', color: 'text-primary' };
  if (/\.pdf$/.test(lower)) return { icon: 'picture_as_pdf', color: 'text-error' };
  if (/\.pptx?$/.test(lower)) return { icon: 'slideshow', color: 'text-tertiary' };
  return { icon: 'description', color: 'text-primary' };
}
