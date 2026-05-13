// localStorage-backed search history for the SearchModal.
// Capped at MAX entries, deduped (most-recent first).

const KEY = 'brightnow.searchHistory';
const MAX = 5;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushHistory(query) {
  const q = (query || '').trim();
  if (!q) return loadHistory();
  const next = [q, ...loadHistory().filter((existing) => existing !== q)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore quota errors */ }
  return next;
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
