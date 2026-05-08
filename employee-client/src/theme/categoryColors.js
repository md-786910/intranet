// Maps category name (case-insensitive) to a Tailwind class palette.
// Used by CategoryPill and small uppercase tags on news cards.
//
// Reference: tailwind.config.js — primary, secondary, tertiary, *-container tokens
// are the source of truth. All entries below compose existing tokens, so changing
// a token in tailwind.config.js cascades everywhere.

export const CATEGORY_COLORS = {
  default: {
    text: 'text-primary',
    bg: 'bg-primary-container/30',
    solidBg: 'bg-primary-container',
    solidText: 'text-on-primary-container',
    border: 'border-primary-container',
  },
  // Primary (blue) family
  strategy: { _ref: 'default' },
  'company strategy': { _ref: 'default' },
  engineering: { _ref: 'default' },
  innovation: { _ref: 'default' },
  'global expansion': { _ref: 'default' },
  sustainability: { _ref: 'default' },
  community: { _ref: 'default' },

  // Tertiary (warm) family
  marketing: {
    text: 'text-tertiary',
    bg: 'bg-tertiary-container/40',
    solidBg: 'bg-tertiary-container',
    solidText: 'text-on-tertiary-container',
    border: 'border-tertiary-container',
  },
  culture: { _ref: 'marketing' },
  'human resources': { _ref: 'marketing' },

  // Secondary (neutral) family
  management: {
    text: 'text-secondary',
    bg: 'bg-secondary-container',
    solidBg: 'bg-secondary-container',
    solidText: 'text-on-secondary-container',
    border: 'border-secondary-container',
  },
  policy: {
    text: 'text-on-secondary-fixed-variant',
    bg: 'bg-secondary-container',
    solidBg: 'bg-secondary-container',
    solidText: 'text-on-secondary-container',
    border: 'border-secondary-container',
  },
  policies: { _ref: 'policy' },
};

function resolve(palette) {
  if (!palette || typeof palette !== 'object') return CATEGORY_COLORS.default;
  if (palette._ref) return resolve(CATEGORY_COLORS[palette._ref]);
  return palette;
}

export function categoryPalette(name) {
  if (!name) return CATEGORY_COLORS.default;
  const key = String(name).trim().toLowerCase();
  return resolve(CATEGORY_COLORS[key]) || CATEGORY_COLORS.default;
}
