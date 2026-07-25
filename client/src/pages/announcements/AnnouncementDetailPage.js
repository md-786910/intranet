import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import PriorityBadge from "../../components/common/PriorityBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AudienceTree from "../../components/common/AudienceTree";
import RichTextView from "../../components/common/RichTextView";
import { announcementService } from "../../services/announcementService";
import { useToast } from "../../hooks/useToast";
import { formatDate, formatDateTime } from "../../utils/formatters";
import { usePermission } from "../../hooks/usePermission";
import NotFoundState from "../../components/common/NotFoundState";
import { getErrorMessage, getUserFacingMessage, isNotFoundError } from "../../utils/errorUtils";

export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canPublish } = usePermission("NEWS", "PUBLISH");
  const { hasPermission: canEdit } = usePermission("NEWS", "EDIT");
  const { hasPermission: canDelete } = usePermission("NEWS", "DELETE");
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const fetchItem = () => {
    setNotFound(false);
    setLoadError(false);
    announcementService
      .get(id)
      .then((res) => setItem(res.data?.data))
      .catch((err) => {
        setItem(null);
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setLoadError(true);
        if (!err?.isHandled) addToast(getUserFacingMessage(err, "Failed to load announcement"), "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItem();
  }, [id]); // eslint-disable-line

  // Light auto-refresh while SCHEDULED so the page flips to PUBLISHED soon
  // after the backend publisher fires.
  useEffect(() => {
    if (item?.status !== "SCHEDULED") return undefined;
    const t = setInterval(() => { fetchItem(); }, 15 * 1000);
    return () => clearInterval(t);
  }, [item?.status, id]); // eslint-disable-line

  const askPublish = () =>
    setPendingAction({
      title: "Publish announcement",
      message: `Publish "${item.title}"? It will become visible to everyone in the audience${item.push_notify === false ? " (silently — push notifications are off for this announcement)" : " and an in-app notification will be sent"}.`,
      confirmLabel: "Publish",
      confirmVariant: "primary",
      run: async () => {
        await announcementService.publish(id);
        addToast(
          item.push_notify === false
            ? "Announcement published"
            : "Announcement published — employees notified",
          "success",
        );
        fetchItem();
      },
    });

  const askUnpublish = () =>
    setPendingAction({
      title: "Unpublish announcement",
      message: `Unpublish "${item.title}"? It will revert to draft.`,
      confirmLabel: "Unpublish",
      confirmVariant: "primary",
      run: async () => {
        await announcementService.unpublish(id);
        addToast("Announcement unpublished", "success");
        fetchItem();
      },
    });

  const askUnschedule = () =>
    setPendingAction({
      title: "Cancel schedule",
      message: `Cancel the scheduled publish for "${item.title}"? It will revert to draft.`,
      confirmLabel: "Cancel schedule",
      confirmVariant: "primary",
      run: async () => {
        await announcementService.unschedule(id);
        addToast("Schedule cancelled — back to draft", "success");
        fetchItem();
      },
    });

  const askArchive = () =>
    setPendingAction({
      title: "Move to archive",
      message: `Move "${item.title}" to the archive?`,
      confirmLabel: "Move to archive",
      confirmVariant: "danger",
      run: async () => {
        await announcementService.remove(id);
        addToast("Announcement moved to archive", "success");
        navigate("/announcements");
      },
    });

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      await pendingAction.run();
      setPendingAction(null);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, "Action failed"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Announcement"
        title="Announcement not found"
        description="This announcement does not exist or is no longer available."
        backTo="/announcements"
        backLabel="Back to announcements"
      />
    );
  }
  if (loadError || !item) {
    return (
      <NotFoundState
        pageTitle="Announcement"
        title="Unable to load announcement"
        description="Something went wrong while loading this announcement."
        backTo="/announcements"
        backLabel="Back to announcements"
      />
    );
  }

  const inMarqueeWindow = (() => {
    if (!item.show_in_marquee) return false;
    const now = Date.now();
    if (
      item.marquee_starts_at &&
      new Date(item.marquee_starts_at).getTime() > now
    )
      return false;
    if (item.marquee_ends_at && new Date(item.marquee_ends_at).getTime() <= now)
      return false;
    return true;
  })();

  return (
    <div>
      <PageHeader
        title={item.title}
        backTo="/announcements"
        actions={
          <div className="flex gap-2">
            {canPublish && item.status === "DRAFT" && (
              <Button onClick={askPublish}>Publish</Button>
            )}
            {canPublish && item.status === "SCHEDULED" && (
              <Button variant="secondary" onClick={askUnschedule}>
                Cancel Schedule
              </Button>
            )}
            {canPublish && item.status === "PUBLISHED" && (
              <Button variant="secondary" onClick={askUnpublish}>
                Unpublish
              </Button>
            )}
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/announcements/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canDelete && item.status !== "PUBLISHED" && (
              <Button variant="danger" size="sm" onClick={askArchive}>
                Archive
              </Button>
            )}
          </div>
        }
      />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <StatusBadge status={item.status} />
          <PriorityBadge priority={item.priority || "NORMAL"} hideOnNormal />
          {item.show_in_marquee && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                inMarqueeWindow
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {inMarqueeWindow ? "Marquee · live" : "Marquee · out of window"}
            </span>
          )}
          <span className="text-sm text-gray-500">
            By {item.author?.first_name} {item.author?.last_name}
          </span>
          <span className="text-sm text-gray-400">
            {formatDate(item.created_at)}
          </span>
          {item.status === "SCHEDULED" && item.scheduled_at && (
            <span className="text-sm text-blue-700">
              Scheduled for {formatDateTime(item.scheduled_at)}
            </span>
          )}
          {item.published_at && (
            <span className="text-sm text-green-600">
              Published {formatDate(item.published_at)}
            </span>
          )}
        </div>

        {canPublish && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-3 flex items-start gap-2">
            <input
              type="checkbox"
              checked={item.push_notify !== false}
              readOnly
              disabled
              className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-700">
                Push notify employees in real-time
                {item.push_notify === false && (
                  <span className="ml-2 text-xs uppercase tracking-wide text-gray-500">
                    disabled
                  </span>
                )}
              </span>
              <span className="block text-xs text-gray-500">
                {item.push_notify === false
                  ? "Publishing will not fan out an in-app notification. Change this from the Edit page."
                  : "Publishing will send an instant in-app notification to the audience. Change this from the Edit page."}
              </span>
            </span>
          </div>
        )}

        {item.show_in_marquee &&
          (item.marquee_starts_at || item.marquee_ends_at) && (
            <div className="mb-6 rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-2 text-sm text-amber-900">
              Marquee window:{" "}
              {item.marquee_starts_at
                ? formatDateTime(item.marquee_starts_at)
                : "now"}{" "}
              →{" "}
              {item.marquee_ends_at
                ? formatDateTime(item.marquee_ends_at)
                : "no end"}
            </div>
          )}

        <RichTextView html={item.body} className="text-gray-800" />

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Audience</h3>
          <AudienceTree rules={item.audienceRules || []} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        loading={actionLoading}
        title={pendingAction?.title || "Confirm"}
        message={pendingAction?.message || ""}
        confirmLabel={pendingAction?.confirmLabel || "Confirm"}
        confirmVariant={pendingAction?.confirmVariant || "primary"}
      />
    </div>
  );
}
