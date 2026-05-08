import React from 'react';
import AttachmentChip from './AttachmentChip';

export default function MessageBubble({ message, contact, myInitials = 'JD' }) {
  if (!message) return null;
  const isMe = message.from === 'me';

  // Attachment-only message renders just the chip, with the same alignment
  // logic but no bubble or avatar (matches the design's "ml-10" indent).
  if (message.attachment && !message.text) {
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
          {message.text && <p className="text-body-sm">{message.text}</p>}
          {message.at && (
            <span className="text-[10px] text-blue-100 mt-1 block text-right">
              {message.at}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-unit-sm max-w-[80%]">
      {contact?.avatarUrl ? (
        <img
          className="w-8 h-8 rounded-full shrink-0 border border-outline-variant"
          alt={contact.name}
          src={contact.avatarUrl}
        />
      ) : (
        <div className="w-8 h-8 shrink-0" aria-hidden="true" />
      )}
      <div className="bg-white border border-outline-variant p-unit-md rounded-2xl rounded-bl-none shadow-sm">
        {message.text && <p className="text-body-sm text-on-surface">{message.text}</p>}
        {message.at && (
          <span className="text-[10px] text-outline mt-1 block text-right">{message.at}</span>
        )}
      </div>
    </div>
  );
}
