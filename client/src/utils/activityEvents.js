// Builds chronologically-sorted activity event arrays per entity type for
// the <ActivityTimeline> component. We only show events that actually
// happened — no em-dash placeholders for untouched actions.
//
// When a specific actor column (e.g. published_by) is NULL — typically on
// legacy rows whose audit fields predate migration 054 — we fall back to
// the entity's primary actor (author / creator / uploader) so the timeline
// shows a real name instead of "Unknown".

function pushEvent(events, kind, actor, at) {
  if (!at) return;
  events.push({ kind, actor: actor || null, at });
}

// Newest first — matches the global Activity log and standard CMS convention.
function sortByTime(events) {
  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function newsEvents(article) {
  if (!article) return [];
  const fallback = article.author || null;
  const events = [];
  if (article.created_at) {
    pushEvent(events, 'created', fallback, article.created_at);
  }
  if (article.updated_at && article.updated_at !== article.created_at && (article.updater || fallback)) {
    pushEvent(events, 'updated', article.updater || fallback, article.updated_at);
  }
  if (article.published_at) {
    pushEvent(events, 'published', article.publisher || fallback, article.published_at);
  }
  if (article.unpublished_at) {
    pushEvent(events, 'unpublished', article.unpublisher || fallback, article.unpublished_at);
  }
  if (article.archived_at) {
    pushEvent(events, 'archived', article.archiver || fallback, article.archived_at);
  }
  if (article.deleted_at) {
    pushEvent(events, 'deleted', article.deleter || fallback, article.deleted_at);
  }
  return sortByTime(events);
}

export function documentEvents(doc) {
  if (!doc) return [];
  const fallback = doc.author || null;
  const events = [];
  if (doc.created_at) {
    pushEvent(events, 'created', fallback, doc.created_at);
  }
  if (doc.updated_at && doc.updated_at !== doc.created_at && (doc.updater || fallback)) {
    pushEvent(events, 'updated', doc.updater || fallback, doc.updated_at);
  }
  if (doc.published_at) {
    pushEvent(events, 'published', doc.publisher || fallback, doc.published_at);
  }
  if (doc.unpublished_at) {
    pushEvent(events, 'unpublished', doc.unpublisher || fallback, doc.unpublished_at);
  }
  if (doc.deleted_at) {
    pushEvent(events, 'deleted', doc.deleter || fallback, doc.deleted_at);
  }
  return sortByTime(events);
}

export function categoryEvents(category) {
  if (!category) return [];
  const fallback = category.creator || null;
  const events = [];
  if (category.created_at) {
    pushEvent(events, 'created', fallback, category.created_at);
  }
  if (category.updated_at && category.updated_at !== category.created_at && (category.updater || fallback)) {
    pushEvent(events, 'updated', category.updater || fallback, category.updated_at);
  }
  if (category.deleted_at) {
    pushEvent(events, 'deleted', category.deleter || fallback, category.deleted_at);
  }
  return sortByTime(events);
}

export function mediaEvents(asset) {
  if (!asset) return [];
  const fallback = asset.uploader || null;
  const events = [];
  if (asset.created_at) {
    pushEvent(events, 'uploaded', fallback, asset.created_at);
  }
  if (asset.deleted_at) {
    pushEvent(events, 'deleted', asset.deleter || fallback, asset.deleted_at);
  }
  return sortByTime(events);
}
