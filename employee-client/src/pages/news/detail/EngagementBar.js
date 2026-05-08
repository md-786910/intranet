import React, { useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';

// Visual-only engagement bar. Heart toggles client-side; the rest toast
// "coming soon" until backend endpoints are wired up.
export default function EngagementBar({ likes = 0, comments = 0 }) {
  const [liked, setLiked] = useState(false);
  const toast = useToast();

  const displayLikes = liked ? likes + 1 : likes;

  return (
    <div className="mt-unit-xl pt-unit-lg border-t border-outline-variant flex justify-between items-center">
      <div className="flex items-center gap-unit-lg">
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Like"
        >
          <span
            className="material-symbols-outlined"
            style={liked ? { fontVariationSettings: '"FILL" 1' } : undefined}
          >
            favorite
          </span>
          <span className="font-semibold">{formatCount(displayLikes)}</span>
        </button>
        <button
          type="button"
          onClick={() => toast.info('Comments coming soon.')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon name="forum" />
          <span className="font-semibold">{formatCount(comments)}</span>
        </button>
      </div>
      <div className="flex items-center gap-unit-md">
        <button
          type="button"
          onClick={() => toast.info('Sharing coming soon.')}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
          aria-label="Share"
        >
          <MaterialIcon name="share" />
        </button>
        <button
          type="button"
          onClick={() => toast.info('Bookmarks coming soon.')}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
          aria-label="Bookmark"
        >
          <MaterialIcon name="bookmark" />
        </button>
      </div>
    </div>
  );
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
