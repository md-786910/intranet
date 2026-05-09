import React from 'react';
import AttachmentChip from './AttachmentChip';

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

export default function MessageBubble({ message, contact, myInitials = 'JD', myUserId }) {
  if (!message) return null;
  const isMe = message.senderId === myUserId;
  const time = formatMessageTime(message.createdAt);

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

  if (isMe) {
    return (
      <div className="flex items-end gap-unit-sm max-w-[80%] self-end flex-row-reverse">
        <div className="w-8 h-8 rounded-full bg-primary-container shrink-0 flex items-center justify-center border border-primary/20">
          <span className="text-on-primary-container text-xs font-bold">{myInitials}</span>
        </div>
        <div className="bg-primary text-white p-unit-md rounded-2xl rounded-br-none shadow-sm">
          {message.content && <p className="text-body-sm">{message.content}</p>}
          {time && (
            <span className="text-[10px] text-blue-100 mt-1 block text-right">{time}</span>
          )}
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
        {message.content && <p className="text-body-sm text-on-surface">{message.content}</p>}
        {time && (
          <span className="text-[10px] text-outline mt-1 block text-right">{time}</span>
        )}
      </div>
    </div>
  );
}
