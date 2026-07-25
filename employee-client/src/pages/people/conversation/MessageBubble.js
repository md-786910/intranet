import React, { useEffect, useState } from 'react';
import AttachmentChip from './AttachmentChip';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return `${f}${l}` || '?';
}

export function canEditMessage(message, myUserId) {
  if (!message || myUserId == null) return false;
  if (Number(message.senderId) !== Number(myUserId)) return false;
  if (message.messageType && message.messageType !== 'TEXT') return false;
  const content = message.content || '';
  if (content.startsWith('[IMAGE:') || content.startsWith('[FILE:')) return false;
  const created = new Date(message.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= EDIT_WINDOW_MS;
}

export default function MessageBubble({
  message,
  contact,
  myInitials = 'JD',
  myUserId,
  onEditMessage,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setDraft(message?.content || '');
  }, [message?.id, message?.content]);

  if (!message) return null;
  const isMe = Number(message.senderId) === Number(myUserId);
  const time = formatMessageTime(message.createdAt);
  const showEdit = isMe && canEditMessage(message, myUserId) && typeof onEditMessage === 'function';
  const isEdited = Boolean(message.editedAt);

  // Attachment-only message
  if (message.attachment && !message.content) {
    return (
      <div
        className={`flex items-end gap-unit-sm max-w-[80%] ${
          isMe ? 'self-end flex-row-reverse mr-10' : 'ml-10'
        }`}
      >
        <AttachmentChip attachment={message.attachment} />
      </div>
    );
  }

  // Parse custom image and file formats
  let contentEl = null;
  if (message.content && message.content.startsWith('[IMAGE:')) {
    const splitIndex = message.content.indexOf(']');
    if (splitIndex > -1) {
      const fileName = message.content.substring(7, splitIndex);
      const base64Data = message.content.substring(splitIndex + 1);

      contentEl = (
        <div className="flex flex-col gap-1">
          <img
            src={base64Data}
            alt={fileName}
            className="w-48 h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-outline-variant/30"
            onClick={() => setIsModalOpen(true)}
          />
          {isModalOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setIsModalOpen(false)}
            >
              <img
                src={base64Data}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <button
                type="button"
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
          )}
        </div>
      );
    }
  } else if (message.content && message.content.startsWith('[FILE:')) {
    const splitIndex = message.content.indexOf(']');
    if (splitIndex > -1) {
      const fileName = message.content.substring(6, splitIndex);
      const base64Data = message.content.substring(splitIndex + 1);

      const parts = fileName.split('.');
      const ext = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';

      const attachmentData = {
        name: fileName,
        kind: `${ext} Document`,
        url: base64Data,
      };

      contentEl = (
        <div className="mt-1">
          <AttachmentChip attachment={attachmentData} />
        </div>
      );
    }
  }

  if (!contentEl && !editing) {
    contentEl = (
      <p className={`text-body-sm break-words whitespace-pre-wrap ${isMe ? 'text-white' : 'text-on-surface'}`}>
        {message.content}
      </p>
    );
  }

  const handleSave = async () => {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEditMessage(message.id, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const metaRow = (
    <div className={`flex items-center gap-2 mt-1 ${isMe ? 'justify-end' : 'justify-end'}`}>
      {isEdited && (
        <span className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-outline'}`}>edited</span>
      )}
      {time && (
        <span className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-outline'}`}>{time}</span>
      )}
      {showEdit && !editing && (
        <button
          type="button"
          onClick={() => {
            setDraft(message.content || '');
            setEditing(true);
          }}
          className={`text-[10px] font-semibold underline-offset-2 hover:underline ${
            isMe ? 'text-blue-50' : 'text-primary'
          }`}
        >
          Edit
        </button>
      )}
    </div>
  );

  if (isMe) {
    return (
      <div className="flex items-end gap-unit-sm max-w-[80%] self-end flex-row-reverse group">
        <div className="w-8 h-8 rounded-full bg-primary-container shrink-0 flex items-center justify-center border border-primary/20">
          <span className="text-on-primary-container text-xs font-bold">{myInitials}</span>
        </div>
        <div className="bg-primary text-white p-unit-md rounded-2xl rounded-br-none shadow-sm min-w-[8rem]">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border-0 bg-white/15 text-white text-body-sm p-2 resize-none focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-blue-100"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft(message.content || '');
                    setEditing(false);
                  }}
                  className="text-[11px] font-semibold text-blue-100 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={handleSave}
                  className="text-[11px] font-semibold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            contentEl
          )}
          {metaRow}
        </div>
      </div>
    );
  }

  const senderAvatar = contact?.avatarUrl || message.sender?.avatarUrl;
  const senderInitials = getInitials(
    contact?.firstName || message.sender?.firstName,
    contact?.lastName || message.sender?.lastName,
  );

  return (
    <div className="flex items-end gap-unit-sm max-w-[80%]">
      {senderAvatar ? (
        <img
          className="w-8 h-8 rounded-full shrink-0 border border-outline-variant"
          alt={senderInitials}
          src={senderAvatar}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary-container/40 shrink-0 flex items-center justify-center border border-outline-variant">
          <span className="text-primary text-[10px] font-bold">{senderInitials}</span>
        </div>
      )}
      <div className="bg-white border border-outline-variant p-unit-md rounded-2xl rounded-bl-none shadow-sm">
        {contentEl}
        {metaRow}
      </div>
    </div>
  );
}
