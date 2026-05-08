// Centralised date helpers for news / activity displays.

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return formatDate(iso);
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m}m ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h}h ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

// "5 min read" style — body length / 200 wpm + extra time for media.
export function readingTime(body) {
  if (!body) return '1 min read';
  const raw = String(body);

  // Count embedded media elements that take time to consume
  const imageCount = (raw.match(/<img[\s>]/gi) || []).length;
  const iframeCount = (raw.match(/<iframe[\s>]/gi) || []).length;

  // Strip HTML tags and count words
  const text = raw.replace(/<[^>]*>/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;

  // 200 wpm for text + 12s per image + 30s per iframe
  const textMinutes = words / 200;
  const mediaMinutes = (imageCount * 12 + iframeCount * 30) / 60;
  const minutes = Math.max(1, Math.round(textMinutes + mediaMinutes));
  return `${minutes} min read`;
}
