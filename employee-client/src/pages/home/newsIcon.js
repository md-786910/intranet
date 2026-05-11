// Stable icon selection for a news article — same article id always picks
// the same icon so cards don't shuffle between renders.
// Shared by LatestAnnouncements + TodayCard on the home page.

const CATEGORY_ICONS = {
  strategy: 'campaign',
  'company strategy': 'campaign',
  marketing: 'brush',
  culture: 'celebration',
  engineering: 'memory',
  innovation: 'lightbulb',
  'global expansion': 'public',
  sustainability: 'eco',
  community: 'groups',
  management: 'analytics',
  policy: 'policy',
  policies: 'policy',
  'human resources': 'badge',
};

const FALLBACK_ICONS = [
  'campaign',
  'auto_awesome',
  'lightbulb',
  'rocket_launch',
  'trending_up',
  'stars',
  'newspaper',
  'bolt',
];

export function iconFor(article) {
  const cat = article?.category?.name?.trim().toLowerCase();
  if (cat && CATEGORY_ICONS[cat]) return CATEGORY_ICONS[cat];
  const seed = article?.news_item_id ?? 0;
  return FALLBACK_ICONS[Math.abs(seed) % FALLBACK_ICONS.length];
}
