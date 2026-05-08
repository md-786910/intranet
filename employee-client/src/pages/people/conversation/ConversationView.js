import React from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';

export default function ConversationView({
  conversation,
  myInitials,
  onSend,
  onBack,
  className = '',
}) {
  if (!conversation) return null;
  return (
    <section
      className={`flex flex-col bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden h-full ${className}`}
    >
      <ChatHeader contact={conversation} onBack={onBack} />
      <MessageList
        messages={conversation.messages}
        contact={conversation}
        myInitials={myInitials}
      />
      <ChatComposer onSend={onSend} />
    </section>
  );
}
