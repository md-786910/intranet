import React, { useState, useEffect } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import FilePicker from '../../components/common/FilePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import MediaTypeIcon, { getMediaKind } from '../../components/common/MediaTypeIcon';
import MediaPreviewDrawer from '../../components/common/MediaPreviewDrawer';
import { PRIORITY_OPTIONS } from '../../components/common/PriorityBadge';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';
import { usePublishingScope } from '../../hooks/usePublishingScope';
import { resolveAssetUrl } from '../../utils/mediaUrl';
import { formatDate, formatFileSize } from '../../utils/formatters';

export default function DocumentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { hasPermission: canEditDocuments } = usePermission('DOCUMENTS', 'EDIT');
  const { lockAudience, lockedTargets, owningScope } = usePublishingScope();

  const [form, setForm] = useState({ title: '', summary: '', category_id: '', priority: 'NORMAL' });
  const [audienceTargets, setAudienceTargets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);

  // New-version uploader state — separate transaction from metadata save.
  const [newFiles, setNewFiles] = useState([]);
  const [changelog, setChangelog] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  useEffect(() => {
    documentService.getDocument(id)
      .then((res) => {
        const d = res.data?.data;
        setForm({
          title: d.title || '',
          summary: d.summary || '',
          category_id: d.category_id ? String(d.category_id) : '',
          priority: d.priority || 'NORMAL',
        });
        setAudienceTargets((d.audienceRules || []).map((rule) => ({
          scope_type: rule.target_scope_type,
          scope_id: rule.target_scope_id,
          scope_label: rule.scope_label,
        })));
        setVersions(Array.isArray(d.versions) ? d.versions : []);
      })
      .catch(() => addToast('Failed to load document', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => {
    if (lockAudience && !loading) setAudienceTargets(lockedTargets);
  }, [lockAudience, lockedTargets, loading]);

  useEffect(() => {
    if (!currentOrganisationId) return;
    documentService.getCategories({ scope_type: 'ORGANISATION', scope_id: currentOrganisationId })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, [currentOrganisationId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSaveMetadata = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await documentService.updateDocument(id, {
        title: form.title,
        summary: form.summary || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        priority: form.priority || 'NORMAL',
        scope_type: owningScope.scope_type,
        scope_id: owningScope.scope_id,
        audience_targets: audienceTargets.map((target) => ({
          scope_type: target.scope_type,
          scope_id: target.scope_id,
        })),
      });
      addToast('Document updated', 'success');
      navigate(`/documents/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!newFiles.length) { addToast('Attach at least one file or URL', 'error'); return; }
    setUploadingVersion(true);
    try {
      await documentService.uploadVersion(id, {
        files: newFiles,
        changelog: changelog.trim() || null,
      });
      addToast('New version uploaded', 'success');
      setNewFiles([]);
      setChangelog('');
      navigate(`/documents/${id}`);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to upload version', 'error');
    } finally {
      setUploadingVersion(false);
    }
  };

  if (!canEditDocuments) {
    return <Navigate to={`/documents/${id}`} replace />;
  }

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;

  return (
    <div>
      <PageHeader title="Edit Document" backTo={`/documents/${id}`} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <Input label="Title" name="title" required value={form.title} onChange={handleChange} />
        <Textarea label="Summary" name="summary" value={form.summary} onChange={handleChange} rows={3} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Category"
            name="category_id"
            value={form.category_id}
            onChange={handleChange}
            placeholder="Select category (optional)"
            options={categories.map((c) => ({ value: String(c.category_id), label: c.name }))}
          />
          <Select
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            options={PRIORITY_OPTIONS}
          />
        </div>
        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700">Audience</h3>
            <p className="text-xs text-gray-500 mt-1">
              {lockAudience
                ? 'Audience is locked to your assigned scope. Contact a Platform Owner to publish elsewhere.'
                : 'Choose which organisation scopes can view this document once published.'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <HierarchyScopeSelector
              value={audienceTargets}
              onChange={setAudienceTargets}
              disabled={lockAudience}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate(`/documents/${id}`)}>Cancel</Button>
          <Button onClick={handleSaveMetadata} loading={saving}>Save Changes</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Existing files</h2>
          <p className="text-xs text-gray-500 mt-1">
            All files attached across every version. Click any row to preview. To replace or add files, upload a new version below.
          </p>
        </div>
        {versions.length === 0 ? (
          <p className="text-sm text-gray-500">No versions yet.</p>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => {
              const versionFiles = Array.isArray(v.files) && v.files.length > 0
                ? v.files
                : v.file_url
                  ? [{ url: v.file_url, name: v.file_name, size: v.file_size, mime: v.mime_type, source: 'url' }]
                  : [];
              return (
                <div key={v.document_version_id} className="rounded-lg bg-gray-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">v{v.version_no}</span>
                      <span className="text-gray-400 text-xs">
                        {versionFiles.length} file{versionFiles.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {v.uploader?.first_name} {v.uploader?.last_name} · {formatDate(v.created_at)}
                    </div>
                  </div>
                  {v.changelog && <div className="text-xs text-gray-500">{v.changelog}</div>}
                  {versionFiles.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No files attached.</p>
                  ) : (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Upload new version</h2>
          <p className="text-xs text-gray-500 mt-1">
            Existing versions stay in the history. Files attached here become version v{(versions[0]?.version_no || 0) + 1}.
          </p>
        </div>
        <FilePicker
          label="Files"
          mode="file"
          multiple
          context="document"
          value={newFiles}
          onChange={setNewFiles}
        />
        <Input
          label="Changelog"
          name="changelog"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="What changed in this version? (optional)"
        />
        <div className="flex justify-end pt-2">
          <Button onClick={handleUploadVersion} loading={uploadingVersion} disabled={!newFiles.length}>
            Save new version
          </Button>
        </div>
      </div>

      <MediaPreviewDrawer
        asset={previewAsset}
        open={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
      />
    </div>
  );
}
