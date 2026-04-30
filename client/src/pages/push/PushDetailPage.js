import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { pushService } from '../../services/pushService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const DEFAULT_ORGANISATION_ID = 1;

export default function PushDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const fetchCampaign = () => {
    pushService.getCampaign(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => setCampaign(res.data?.data))
      .catch(() => addToast('Failed to load campaign', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaign(); }, [id]); // eslint-disable-line

  const handleSend = async () => {
    setActionLoading(true);
    try {
      await pushService.sendCampaign(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID });
      addToast('Campaign sent', 'success');
      fetchCampaign();
    } catch (err) {
      addToast(err.response?.data?.message || 'Send failed', 'error');
    } finally {
      setActionLoading(false);
      setSendOpen(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await pushService.cancelCampaign(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID });
      addToast('Campaign cancelled', 'success');
      fetchCampaign();
    } catch (err) {
      addToast(err.response?.data?.message || 'Cancel failed', 'error');
    } finally {
      setActionLoading(false);
      setCancelOpen(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!campaign) return <div className="text-center py-12 text-gray-500">Campaign not found</div>;

  return (
    <div>
      <PageHeader
        title={campaign.title}
        backTo="/push"
        actions={
          <div className="flex gap-2">
            {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
              <Button onClick={() => setSendOpen(true)}>Send Now</Button>
            )}
            {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>Cancel</Button>
            )}
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <StatusBadge status={campaign.status} />
          <span className="text-sm text-gray-500">
            By {campaign.creator?.first_name} {campaign.creator?.last_name}
          </span>
          <span className="text-sm text-gray-400">{formatDate(campaign.created_at)}</span>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-800">{campaign.body}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{campaign.recipient_count || 0}</div>
            <div className="text-xs text-gray-500">Recipients</div>
          </div>
          {campaign.sent_at && (
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-sm font-medium text-green-800">{formatDate(campaign.sent_at)}</div>
              <div className="text-xs text-green-600">Sent At</div>
            </div>
          )}
          {campaign.scheduled_at && (
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-sm font-medium text-blue-800">{formatDate(campaign.scheduled_at)}</div>
              <div className="text-xs text-blue-600">Scheduled For</div>
            </div>
          )}
        </div>

        {campaign.audienceRules?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Target Audience</h3>
            <div className="flex flex-wrap gap-2">
              {campaign.audienceRules.map((r) => (
                <span key={r.audience_rule_id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {r.target_scope_type}: {r.target_scope_id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog isOpen={sendOpen} onCancel={() => setSendOpen(false)}
        onConfirm={handleSend} loading={actionLoading} confirmVariant="primary"
        title="Send Campaign" message="Send this push notification to all targeted users?" confirmLabel="Send Now" />
      <ConfirmDialog isOpen={cancelOpen} onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel} loading={actionLoading}
        title="Cancel Campaign" message="Cancel this campaign? This cannot be undone." />
    </div>
  );
}
