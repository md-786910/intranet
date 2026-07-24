import React from 'react';

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessageBubble({ message, myUserId, myInitials, contactInitials, contactAvatar }) {
  if (!message) return null;
  const isMe = Number(message.senderId) === Number(myUserId);
  const time = formatMessageTime(message.createdAt || message.created_at);
  const content = message.content || '';

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
        className={`px-3 py-2 rounded-2xl shadow-sm ${
          isMe
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        {time && (
          <span className={`text-[10px] mt-1 block text-right ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
