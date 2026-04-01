import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const DEFAULT_ORGANISATION_ID = 1;

export default function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchArticle = () => {
    newsService.getArticle(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => setArticle(res.data?.data))
      .catch(() => addToast('Failed to load article', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchArticle(); }, [id]); // eslint-disable-line

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      await newsService.publishArticle(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID });
      addToast('Article published', 'success');
      fetchArticle();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to publish', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    try {
      await newsService.archiveArticle(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID });
      addToast('Article archived', 'success');
      fetchArticle();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to archive', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await newsService.deleteArticle(id);
      addToast('Article deleted', 'success');
      navigate('/news');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete', 'error');
    } finally {
      setActionLoading(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!article) return <div className="text-center py-12 text-gray-500">Article not found</div>;

  return (
    <div>
      <PageHeader
        title={article.title}
        actions={
          <div className="flex gap-2">
            {article.status === 'DRAFT' && (
              <Button onClick={handlePublish} loading={actionLoading}>Publish</Button>
            )}
            {article.status === 'PUBLISHED' && (
              <Button variant="secondary" onClick={handleArchive} loading={actionLoading}>Archive</Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/news/${id}/edit`)}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <StatusBadge status={article.status} />
          <span className="text-sm text-gray-500">
            By {article.author?.first_name} {article.author?.last_name}
          </span>
          <span className="text-sm text-gray-400">{formatDate(article.created_at)}</span>
          {article.published_at && (
            <span className="text-sm text-green-600">Published {formatDate(article.published_at)}</span>
          )}
        </div>
        {article.summary && (
          <p className="text-gray-600 mb-4 italic">{article.summary}</p>
        )}
        {article.cover_image_url && (
          <img src={article.cover_image_url} alt="" className="w-full max-h-64 object-cover rounded-lg mb-6" />
        )}
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">{article.body}</div>

        {article.audienceRules?.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Audience</h3>
            <div className="flex flex-wrap gap-2">
              {article.audienceRules.map((r) => (
                <span key={r.audience_rule_id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {r.target_scope_type}: {r.target_scope_id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={actionLoading}
        title="Delete Article"
        message={`Delete "${article.title}"? This cannot be undone.`}
      />
    </div>
  );
}
