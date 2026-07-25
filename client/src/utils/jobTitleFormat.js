/**
 * Normalize a job title to Title Case: "software engineer" → "Software Engineer".
 */
export function formatJobTitleName(input) {
  const trimmed = String(input || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
    .slice(0, 100);
}
