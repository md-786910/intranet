import React, {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import Avatar from '../../../components/common/Avatar';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Spinner from '../../../components/common/Spinner';
import { useToast } from '../../../hooks/useToast';
import { newsService } from '../../../services/newsService';
import { formatRelative } from '../../../theme/dateFormat';

function authorName(author) {
  if (!author) return 'Unknown user';
  return `${author.first_name || ''} ${author.last_name || ''}`.trim() || 'Unknown user';
}

const CommentsSection = forwardRef(function CommentsSection({ articleId, currentUserId, onCountChange }, ref) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const composerRef = useRef(null);
  const editRef = useRef(null);
  const sectionRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focusComposer: () => {
      setComposerOpen(true);
      // Wait for the composer to mount, then scroll it into view smoothly
      // and focus it so the user can start typing immediately.
      setTimeout(() => {
        composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        composerRef.current?.focus({ preventScroll: true });
      }, 80);
    },
  }), []);

  const closeComposer = () => {
    setComposerOpen(false);
    setBody('');
  };

  const loadPage = async (page = 1) => {
    setLoading(true);
    try {
      const res = await newsService.listComments(articleId, { page, limit: 20 });
      const data = res.data?.data || {};
      setPagination(data.pagination || { page, totalPages: 1, total: data.comments?.length || 0 });
      setComments((prev) => (page === 1 ? data.comments || [] : [...prev, ...(data.comments || [])]));
      if (page === 1 && onCountChange) onCountChange(data.pagination?.total ?? (data.comments?.length || 0));
    } catch {
      toast.error('Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!articleId) return;
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const res = await newsService.addComment(articleId, trimmed);
      const { comment, comment_count } = res.data?.data || {};
      if (comment) setComments((prev) => [comment, ...prev]);
      if (comment_count != null && onCountChange) onCountChange(comment_count);
      setBody('');
      setComposerOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditBody(c.body);
    setTimeout(() => {
      editRef.current?.focus();
      editRef.current?.setSelectionRange(c.body.length, c.body.length);
    }, 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const handleEdit = async (commentId) => {
    const trimmed = editBody.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await newsService.editComment(articleId, commentId, trimmed);
      const { comment } = res.data?.data || {};
      if (comment) {
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: comment.body } : c)));
      }
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update comment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const res = await newsService.deleteComment(articleId, commentId);
      const { comment_count } = res.data?.data || {};
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (comment_count != null && onCountChange) onCountChange(comment_count);
    } catch {
      toast.error('Failed to delete comment.');
    }
  };

  const hasMore = pagination.page < pagination.totalPages;

  return (
    <section ref={sectionRef} className="mt-unit-lg bg-white rounded-2xl border border-outline-variant p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-on-background">
          Comments
          {pagination.total > 0 && (
            <span className="text-on-surface-variant font-normal"> · {pagination.total}</span>
          )}
        </h3>
        {!composerOpen && (
          <button
            type="button"
            onClick={() => {
              setComposerOpen(true);
              setTimeout(() => composerRef.current?.focus(), 50);
            }}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            + Add comment
          </button>
        )}
      </div>

      {composerOpen && (
        <div className="mb-3">
          <div className="rounded-xl border border-outline-variant focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 bg-white transition-shadow">
            <textarea
              ref={composerRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePost();
                }
                if (e.key === 'Escape') closeComposer();
              }}
              rows={2}
              maxLength={2000}
              placeholder="Share your thoughts…"
              className="w-full px-3 py-2 text-sm bg-transparent resize-none focus:outline-none rounded-t-xl"
            />
            <div className="flex justify-between items-center px-3 py-1.5 border-t border-outline-variant/60 bg-surface-container-low/40 rounded-b-xl">
              <span className="text-[11px] text-on-surface-variant">{body.length}/2000</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={!body.trim() || posting}
                  className="px-3 py-1 rounded-md bg-primary text-on-primary font-semibold text-[11px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : comments.length === 0 ? (
        <p className="text-center py-6 text-on-surface-variant text-xs">
          Be the first to comment on this article.
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/40">
          {comments.map((c) => {
            const isMine = currentUserId && c.author?.user_id === currentUserId;
            const isEditing = editingId === c.id;
            return (
              <li key={c.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0 group">
                <Avatar
                  src={c.author?.avatar_url}
                  name={authorName(c.author)}
                  size="sm"
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span className="font-semibold text-[13px] text-on-background truncate">
                      {authorName(c.author)}
                    </span>
                    <span className="text-[11px] text-on-surface-variant whitespace-nowrap" title={new Date(c.created_at).toLocaleString()}>
                      {formatRelative(c.created_at)}
                    </span>
                    {isMine && !isEditing && (
                      <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="text-on-surface-variant hover:text-primary"
                          aria-label="Edit comment"
                        >
                          <MaterialIcon name="edit" className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-on-surface-variant hover:text-error"
                          aria-label="Delete comment"
                        >
                          <MaterialIcon name="close" className="text-sm" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1 rounded-xl border border-primary/40 ring-2 ring-primary/20 bg-white">
                      <textarea
                        ref={editRef}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleEdit(c.id);
                          }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        rows={2}
                        maxLength={2000}
                        className="w-full px-3 py-2 text-sm bg-transparent resize-none focus:outline-none rounded-t-xl"
                      />
                      <div className="flex justify-end items-center px-3 py-1.5 border-t border-outline-variant/60 bg-surface-container-low/40 rounded-b-xl gap-1">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(c.id)}
                          disabled={!editBody.trim() || saving}
                          className="px-3 py-1 rounded-md bg-primary text-on-primary font-semibold text-[11px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-on-background mt-0.5 leading-snug whitespace-pre-wrap break-words">
                      {c.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={() => loadPage(pagination.page + 1)}
            className="text-primary text-[11px] font-semibold hover:underline"
          >
            Load more comments
          </button>
        </div>
      )}
    </section>
  );
});

export default CommentsSection;
