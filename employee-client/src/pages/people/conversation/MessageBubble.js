import React, { useState } from 'react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        url: base64Data, // Data URL acts as href
      };

      contentEl = (
        <div className="mt-1">
          <AttachmentChip attachment={attachmentData} />
        </div>
      );
    }
  }

  if (!contentEl) {
    contentEl = (
      <p className={`text-body-sm break-words whitespace-pre-wrap ${isMe ? 'text-white' : 'text-on-surface'}`}>
        {message.content}
      </p>
    );
  }

  if (isMe) {
    return (
      <div className="flex items-end gap-unit-sm max-w-[80%] self-end flex-row-reverse">
        <div className="w-8 h-8 rounded-full bg-primary-container shrink-0 flex items-center justify-center border border-primary/20">
          <span className="text-on-primary-container text-xs font-bold">{myInitials}</span>
        </div>
        <div className="bg-primary text-white p-unit-md rounded-2xl rounded-br-none shadow-sm">
          {contentEl}
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
        {contentEl}
        {time && (
          <span className="text-[10px] text-outline mt-1 block text-right">{time}</span>
        )}
      </div>
    </div>
  );
}
