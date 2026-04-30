import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatDateTime, formatFileSize } from '../../utils/formatters';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';
import MediaTypeIcon, { getMediaKind } from '../../components/common/MediaTypeIcon';
import MediaPreviewDrawer from '../../components/common/MediaPreviewDrawer';
import AudienceTree from '../../components/common/AudienceTree';
import PriorityBadge from '../../components/common/PriorityBadge';
import { resolveAssetUrl } from '../../utils/mediaUrl';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canPublishDocuments } = usePermission('DOCUMENTS', 'PUBLISH');
  const { hasPermission: canEditDocuments } = usePermission('DOCUMENTS', 'EDIT');
  const { hasPermission: canDeleteDocuments } = usePermission('DOCUMENTS', 'DELETE');
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);

  const fetchDoc = () => {
    documentService.getDocument(id)
      .then((res) => setDoc(res.data?.data))
      .catch(() => addToast('Failed to load document', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDoc(); }, [id]); // eslint-disable-line

  const askPublish = () => setPendingAction({
    title: 'Publish document',
    message: `Publish "${doc.title}"? It will become visible to everyone in the audience.`,
    confirmLabel: 'Publish',
    confirmVariant: 'primary',
    run: async () => {
      await documentService.publishDocument(id, { scope_type: 'ORGANISATION', scope_id: currentOrganisationId });
      addToast('Document published', 'success');
      fetchDoc();
    },
  });

  const askUnpublish = () => setPendingAction({
    title: 'Unpublish document',
    message: `Unpublish "${doc.title}"? It will be hidden from the audience and revert to draft.`,
    confirmLabel: 'Unpublish',
    confirmVariant: 'primary',
    run: async () => {
      await documentService.unpublishDocument(id);
      addToast('Document unpublished — back to draft', 'success');
      fetchDoc();
    },
  });

  const askDelete = () => setPendingAction({
    title: 'Move to archive',
    message: `Move "${doc.title}" to the archive? You can restore or permanently delete it from the Archive view.`,
    confirmLabel: 'Move to archive',
    confirmVariant: 'danger',
    run: async () => {
      await documentService.deleteDocument(id);
      addToast('Document moved to archive', 'success');
      navigate('/documents');
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
  if (!doc) return <div className="text-center py-12 text-gray-500">Document not found</div>;

  return (
    <div>
      <PageHeader
        title={doc.title}
        backTo="/documents"
        actions={
          <div className="flex gap-2">
            {canPublishDocuments && doc.status === 'DRAFT' && (
              <Button onClick={askPublish}>Publish</Button>
            )}
            {canPublishDocuments && doc.status === 'PUBLISHED' && (
              <Button variant="secondary" onClick={askUnpublish}>Unpublish</Button>
            )}
            {canEditDocuments && <Button variant="secondary" onClick={() => navigate(`/documents/${id}/edit`)}>Edit</Button>}
            {canDeleteDocuments && doc.status !== 'PUBLISHED' && (
              <Button variant="danger" size="sm" onClick={askDelete}>
                Archive
              </Button>
            )}
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={doc.status} />
          <PriorityBadge priority={doc.priority || 'NORMAL'} hideOnNormal />
          {doc.category && <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">{doc.category.name}</span>}
          <span className="text-sm text-gray-500">By {doc.author?.first_name} {doc.author?.last_name}</span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatDateTime(doc.created_at)}</dd>
          </div>
          {doc.published_at && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                {doc.status === 'PUBLISHED' ? 'Published' : 'Last published'}
              </dt>
              <dd className="text-gray-900">{formatDateTime(doc.published_at)}</dd>
            </div>
          )}
          {doc.unpublished_at && doc.status !== 'PUBLISHED' && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Unpublished</dt>
              <dd className="text-gray-900">{formatDateTime(doc.unpublished_at)}</dd>
            </div>
          )}
        </dl>

        {doc.summary && <p className="text-gray-600">{doc.summary}</p>}

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Audience</h3>
          <AudienceTree rules={doc.audienceRules || []} />
        </div>

        {/* Version History */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Version History</h3>
          <div className="space-y-3">
            {doc.versions?.map((v) => {
              const versionFiles = Array.isArray(v.files) && v.files.length > 0
                ? v.files
                : v.file_url
                  ? [{ url: v.file_url, name: v.file_name, size: v.file_size, mime: v.mime_type, source: 'url' }]
                  : [];
              return (
                <div key={v.document_version_id} className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version_no}</span>
                      <span className="text-gray-400 text-xs">
                        {versionFiles.length} file{versionFiles.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs">
                      {v.uploader?.first_name} {v.uploader?.last_name} · {formatDate(v.created_at)}
                    </div>
                  </div>
                  {v.changelog && <div className="text-xs text-gray-500">{v.changelog}</div>}
                  <div className="space-y-1.5">
                    {versionFiles.map((f, idx) => {
                      const url = resolveAssetUrl(f.url);
                      const isImage = getMediaKind(f.mime) === 'image';
                      const openPreview = () => setPreviewAsset({
                        original_name: f.name,
                        url: f.url,
                        mime_type: f.mime,
                        size_bytes: f.size,
                        uploader: v.uploader,
                        created_at: v.created_at,
                      });
                      return (
                        <button
                          key={`${f.url}-${idx}`}
                          type="button"
                          onClick={openPreview}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
                        >
                          {isImage && url ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <MediaTypeIcon mime={f.mime} size="sm" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{f.name || '(unnamed)'}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                              {f.mime && <span className="uppercase">{f.mime.split('/').pop()}</span>}
                              {f.size ? (<><span>·</span><span>{formatFileSize(f.size)}</span></>) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

      <MediaPreviewDrawer
        asset={previewAsset}
        open={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
      />
    </div>
  );
}
