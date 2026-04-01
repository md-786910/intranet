import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatFileSize } from '../../utils/formatters';

const DEFAULT_ORG_UNIT_ID = 1;

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchDoc = () => {
    documentService.getDocument(id, { org_unit_id: DEFAULT_ORG_UNIT_ID })
      .then((res) => setDoc(res.data?.data))
      .catch(() => addToast('Failed to load document', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDoc(); }, [id]); // eslint-disable-line

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      await documentService.publishDocument(id, { org_unit_id: DEFAULT_ORG_UNIT_ID });
      addToast('Document published', 'success');
      fetchDoc();
    } catch (err) {
      addToast(err.response?.data?.message || 'Publish failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await documentService.deleteDocument(id);
      addToast('Document deleted', 'success');
      navigate('/documents');
    } catch (err) {
      addToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!doc) return <div className="text-center py-12 text-gray-500">Document not found</div>;

  return (
    <div>
      <PageHeader
        title={doc.title}
        actions={
          <div className="flex gap-2">
            {doc.status === 'DRAFT' && (
              <Button onClick={handlePublish} loading={actionLoading}>Publish</Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/documents/${id}/edit`)}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <StatusBadge status={doc.status} />
          {doc.category && <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">{doc.category.name}</span>}
          <span className="text-sm text-gray-500">By {doc.author?.first_name} {doc.author?.last_name}</span>
        </div>
        {doc.summary && <p className="text-gray-600">{doc.summary}</p>}

        {/* Version History */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Version History</h3>
          <div className="space-y-2">
            {doc.versions?.map((v) => (
              <div key={v.document_version_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium">v{v.version_no}</span>
                  <span className="text-gray-500 ml-2">{v.file_name}</span>
                  {v.file_size && <span className="text-gray-400 ml-2">{formatFileSize(v.file_size)}</span>}
                  {v.changelog && <div className="text-xs text-gray-500 mt-0.5">{v.changelog}</div>}
                </div>
                <div className="text-gray-500 text-xs">
                  {v.uploader?.first_name} {v.uploader?.last_name} - {formatDate(v.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete} loading={actionLoading}
        title="Delete Document" message={`Delete "${doc.title}"? This cannot be undone.`} />
    </div>
  );
}
