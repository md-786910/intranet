// Maps a notification to the route the bell should navigate to on click.
//
// Documents don't have a dedicated detail route — the preview opens via a
// drawer rendered inside DocumentsPage. We deep-link with `?preview=<id>` so
// the page can fetch that single document and auto-open the drawer.
export function deeplinkFor(notification) {
  if (!notification) return '/home';
  if (notification.type === 'NEWS') return `/news/${notification.entity_id}`;
  if (notification.type === 'DOCUMENT') return `/documents?preview=${notification.entity_id}`;
  return '/home';
}
