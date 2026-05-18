import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import AudienceTree from '../../components/common/AudienceTree';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import RichTextView from '../../components/common/RichTextView';
import PriorityBadge from '../../components/common/PriorityBadge';
import { newsEvents } from '../../utils/activityEvents';
import NewsEngagementPanel from './detail/NewsEngagementPanel';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { resolveAssetUrl } from '../../utils/mediaUrl';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';

export default function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canPublishNews } = usePermission('NEWS', 'PUBLISH');
  const { hasPermission: canEditNews } = usePermission('NEWS', 'EDIT');
  const { hasPermission: canDeleteNews } = usePermission('NEWS', 'DELETE');
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const fetchArticle = () => {
    newsService.getArticle(id)
      .then((res) => setArticle(res.data?.data))
      .catch(() => addToast('Failed to load article', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchArticle(); }, [id]); // eslint-disable-line

  // Light auto-refresh: while the article is SCHEDULED, poll every 15s so the
  // page flips to PUBLISHED soon after the backend publisher fires. Stops once
  // the status leaves SCHEDULED.
  useEffect(() => {
    if (article?.status !== 'SCHEDULED') return undefined;
    const t = setInterval(() => { fetchArticle(); }, 15 * 1000);
    return () => clearInterval(t);
  }, [article?.status, id]); // eslint-disable-line

  const askPublish = () => setPendingAction({
    title: 'Publish article',
    message: `Publish "${article.title}"? It will become visible to everyone in the audience${article.push_notify === false ? ' (silently — push notifications are off for this article)' : ' and an in-app notification will be sent'}.`,
    confirmLabel: 'Publish',
    confirmVariant: 'primary',
    run: async () => {
      // Backend reads push_notify from the entity; no override sent.
      await newsService.publishArticle(id);
      addToast(article.push_notify === false ? 'Article published' : 'Article published — employees notified', 'success');
      fetchArticle();
    },
  });

  const askUnpublish = () => setPendingAction({
    title: 'Unpublish article',
    message: `Unpublish "${article.title}"? It will be hidden from the audience and revert to draft.`,
    confirmLabel: 'Unpublish',
    confirmVariant: 'primary',
    run: async () => {
      await newsService.unpublishArticle(id);
      addToast('Article unpublished — back to draft', 'success');
      fetchArticle();
    },
  });

  const askUnschedule = () => setPendingAction({
    title: 'Cancel schedule',
    message: `Cancel the scheduled publish for "${article.title}"? It will revert to draft and you can publish it manually or reschedule later.`,
    confirmLabel: 'Cancel schedule',
    confirmVariant: 'primary',
    run: async () => {
      await newsService.unscheduleArticle(id);
      addToast('Schedule cancelled — back to draft', 'success');
      fetchArticle();
    },
  });

  const askArchive = () => setPendingAction({
    title: 'Move to archive',
    message: `Move "${article.title}" to the archive? You can restore or permanently delete it from the Archive view.`,
    confirmLabel: 'Move to archive',
    confirmVariant: 'danger',
    run: async () => {
      await newsService.deleteArticle(id);
      addToast('Article moved to archive', 'success');
      navigate('/news');
    },
  });

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      await pendingAction.run();
      setPendingAction(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!article) return <div className="text-center py-12 text-gray-500">Article not found</div>;

  return (
    <div>
      <PageHeader
        title={article.title}
        backTo="/news"
        actions={
          <div className="flex gap-2">
            {canPublishNews && article.status === 'DRAFT' && (
              <Button onClick={askPublish}>Publish</Button>
            )}
            {canPublishNews && article.status === 'SCHEDULED' && (
              <Button variant="secondary" onClick={askUnschedule}>Cancel Schedule</Button>
            )}
            {canPublishNews && article.status === 'PUBLISHED' && (
              <Button variant="secondary" onClick={askUnpublish}>Unpublish</Button>
            )}
            {canEditNews && <Button variant="secondary" onClick={() => navigate(`/news/${id}/edit`)}>Edit</Button>}
            {canDeleteNews && article.status !== 'PUBLISHED' && (
              <Button variant="danger" size="sm" onClick={askArchive}>
                Archive
              </Button>
            )}
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <StatusBadge status={article.status} />
          <PriorityBadge priority={article.priority || 'NORMAL'} hideOnNormal />
          {article.category && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
              {article.category.name}
            </span>
          )}
          <span className="text-sm text-gray-500">
            By {article.author?.first_name} {article.author?.last_name}
          </span>
          <span className="text-sm text-gray-400">{formatDate(article.created_at)}</span>
          {article.status === 'SCHEDULED' && article.scheduled_at && (
            <span className="text-sm text-blue-700">
              Scheduled for {formatDateTime(article.scheduled_at)}
            </span>
          )}
          {article.published_at && (
            <span className="text-sm text-green-600">Published {formatDate(article.published_at)}</span>
          )}
        </div>
        {canPublishNews && (
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-3 mb-6 flex items-start gap-2">
            <input
              type="checkbox"
              checked={article.push_notify !== false}
              readOnly
              disabled
              className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-700">
                Push notify employees in real-time
                {article.push_notify === false && <span className="ml-2 text-xs uppercase tracking-wide text-gray-500">disabled</span>}
              </span>
              <span className="block text-xs text-gray-500">
                {article.push_notify === false
                  ? 'Publishing will not fan out an in-app notification. Change this from the Edit page.'
                  : 'Publishing will send an instant in-app notification to the audience. Change this from the Edit page.'}
              </span>
            </span>
          </div>
        )}
        {article.summary && (
          <p className="text-gray-600 mb-4 italic">{article.summary}</p>
        )}
        {article.cover_image_url && (
          <img
            src={resolveAssetUrl(article.cover_image_url)}
            alt=""
            className="w-full max-h-64 object-cover rounded-lg mb-6"
          />
        )}
        <RichTextView html={article.body} className="text-gray-800" />

        {Array.isArray(article.relatedNews) && article.relatedNews.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Related articles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {article.relatedNews.map((r) => (
                <button
                  key={r.news_item_id}
                  type="button"
                  onClick={() => navigate(`/news/${r.news_item_id}`)}
                  className="text-left rounded-lg border border-gray-200 bg-white p-3 hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <StatusBadge status={r.status} />
                    {r.published_at && (
                      <span className="text-xs text-gray-400">{formatDate(r.published_at)}</span>
                    )}
                  </div>
                  <div className="font-medium text-gray-900 line-clamp-2">{r.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Audience</h3>
          <AudienceTree rules={article.audienceRules || []} />
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Activity</h3>
          <ActivityTimeline events={newsEvents(article)} />
        </div>
      </div>

      <div className="mt-6">
        <NewsEngagementPanel articleId={article.news_item_id} />
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        loading={actionLoading}
        title={pendingAction?.title || 'Confirm'}
        message={pendingAction?.message || ''}
        confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
        confirmVariant={pendingAction?.confirmVariant || 'primary'}
      />
    </div>
  );
}
