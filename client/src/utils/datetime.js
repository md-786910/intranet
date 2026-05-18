// Helpers for `<input type="datetime-local">` ↔ ISO conversion.
// Browsers expect `yyyy-MM-ddTHH:mm` (no timezone, no seconds) for the input
// value, while the API wants ISO-8601 with timezone. Originally lived inline
// in AnnouncementCreatePage — pulled out so the schedule popover can reuse it.

export function toLocalInputValue(isoOrNull) {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
