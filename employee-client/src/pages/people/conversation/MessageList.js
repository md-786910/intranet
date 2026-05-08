import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import DayDivider from './DayDivider';

export default function MessageList({ messages, contact, myInitials }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-grow overflow-y-auto p-unit-lg bg-surface chat-scrollbar flex flex-col gap-unit-md min-h-0">
      <DayDivider label="Today" />
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          contact={contact}
          myInitials={myInitials}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
