import React, { useEffect, useState } from 'react';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function canEditMessage(message, myUserId) {
  if (!message || myUserId == null) return false;
  if (Number(message.senderId) !== Number(myUserId)) return false;
  if (message.messageType && message.messageType !== 'TEXT') return false;
  const created = new Date(message.createdAt || message.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= EDIT_WINDOW_MS;
}

export default function MessageBubble({
  message,
  myUserId,
  myInitials,
  contactInitials,
  contactAvatar,
  onEditMessage,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setDraft(message?.content || '');
  }, [message?.id, message?.content]);

  if (!message) return null;
  const isMe = Number(message.senderId) === Number(myUserId);
  const time = formatMessageTime(message.createdAt || message.created_at);
  const content = message.content || '';
  const showEdit = isMe && canEditMessage(message, myUserId) && typeof onEditMessage === 'function';
  const isEdited = Boolean(message.editedAt || message.edited_at);

  const handleSave = async () => {
    const next = draft.trim();
    if (!next || next === content) {
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

  return (
    <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : ''}`}>
      {isMe ? (
        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 shrink-0 flex items-center justify-center text-[10px] font-bold">
          {myInitials}
        </div>
      ) : contactAvatar ? (
        <img src={contactAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 shrink-0 flex items-center justify-center text-[10px] font-bold">
          {contactInitials}
        </div>
      )}
      <div
        className={`px-3 py-2 rounded-2xl shadow-sm min-w-[7rem] ${
          isMe
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
        }`}
      >
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className={`w-full rounded-md text-sm p-2 resize-none focus:outline-none focus:ring-2 ${
                isMe
                  ? 'bg-white/15 text-white focus:ring-white/40 placeholder:text-primary-100'
                  : 'bg-gray-50 text-gray-900 border border-gray-200 focus:ring-primary-200'
              }`}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(content);
                  setEditing(false);
                }}
                className={`text-[11px] font-semibold ${isMe ? 'text-primary-100 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draft.trim()}
                onClick={handleSave}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-50 ${
                  isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }`}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-1">
          {isEdited && (
            <span className={`text-[10px] ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>edited</span>
          )}
          {time && (
            <span className={`text-[10px] ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
              {time}
            </span>
          )}
          {showEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
              className={`text-[10px] font-semibold underline-offset-2 hover:underline ${
                isMe ? 'text-primary-50' : 'text-primary-600'
              }`}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
