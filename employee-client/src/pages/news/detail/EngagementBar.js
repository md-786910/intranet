import React, { useEffect, useRef, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';
import { newsService } from '../../../services/newsService';

export default function EngagementBar({
  articleId,
  title = '',
  initialLiked = false,
  initialSaved = false,
  initialLikeCount = 0,
  initialCommentCount = 0,
  initialShareCount = 0,
  onCommentClick,
}) {
  const toast = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [shareOpen, setShareOpen] = useState(false);
  const sharePopoverRef = useRef(null);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);
  useEffect(() => { setLikeCount(initialLikeCount); }, [initialLikeCount]);
  useEffect(() => { setCommentCount(initialCommentCount); }, [initialCommentCount]);
  useEffect(() => { setShareCount(initialShareCount); }, [initialShareCount]);

  useEffect(() => {
    if (!shareOpen) return undefined;
    const onClick = (e) => {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(e.target)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [shareOpen]);

  const handleLike = async () => {
    if (!articleId) return;
    const next = !liked;
    // Optimistic update
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = next
        ? await newsService.likeArticle(articleId)
        : await newsService.unlikeArticle(articleId);
      if (res.data?.data?.like_count != null) setLikeCount(res.data.data.like_count);
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(next ? 'Failed to like.' : 'Failed to unlike.');
    }
  };

  const handleSave = async () => {
    if (!articleId) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) await newsService.saveArticle(articleId);
      else await newsService.unsaveArticle(articleId);
      toast.success(next ? 'Saved' : 'Removed from saved');
    } catch {
      setSaved(!next);
      toast.error('Failed to update saved status.');
    }
  };

  const performShare = async (channel) => {
    setShareOpen(false);
    try {
      const res = await newsService.shareArticle(articleId, channel);
      const { url, share_count } = res.data?.data || {};
      if (share_count != null) setShareCount(share_count);
      if (!url) throw new Error('Missing URL');

      if (channel === 'LINK_COPY') {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied to clipboard');
        } catch {
          window.prompt('Copy this link:', url);
        }
      } else if (channel === 'EMAIL') {
        const subject = encodeURIComponent(title || 'Shared from BrightNow');
        const body = encodeURIComponent(`${title}\n\n${url}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch {
      toast.error('Failed to create share link.');
    }
  };

  return (
    <div className="mt-unit-xl pt-unit-lg border-t border-outline-variant flex justify-between items-center">
      <div className="flex items-center gap-unit-lg">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-2 transition-colors ${liked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          aria-label="Like"
          aria-pressed={liked}
        >
          <span
            className="material-symbols-outlined"
            style={liked ? { fontVariationSettings: '"FILL" 1' } : undefined}
          >
            favorite
          </span>
          <span className="font-semibold">{formatCount(likeCount)}</span>
        </button>

        <button
          type="button"
          onClick={onCommentClick}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Comments"
        >
          <MaterialIcon name="forum" />
          <span className="font-semibold">{formatCount(commentCount)}</span>
        </button>
      </div>

      <div className="flex items-center gap-unit-md relative" ref={sharePopoverRef}>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors flex items-center gap-1"
          aria-label="Share"
        >
          <MaterialIcon name="share" />
          {shareCount > 0 && (
            <span className="text-xs font-semibold">{formatCount(shareCount)}</span>
          )}
        </button>

        {shareOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-outline-variant rounded-2xl shadow-lg z-10 overflow-hidden">
            <button
              type="button"
              onClick={() => performShare('LINK_COPY')}
              className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-sm flex items-center gap-2"
            >
              <MaterialIcon name="link" className="text-base" />
              Copy link
            </button>
            <button
              type="button"
              onClick={() => performShare('EMAIL')}
              className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-sm flex items-center gap-2"
            >
              <MaterialIcon name="mail" className="text-base" />
              Email
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className={`p-2 rounded-full transition-colors ${saved ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          aria-pressed={saved}
        >
          <span
            className="material-symbols-outlined"
            style={saved ? { fontVariationSettings: '"FILL" 1' } : undefined}
          >
            bookmark
          </span>
        </button>
      </div>
    </div>
  );
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
