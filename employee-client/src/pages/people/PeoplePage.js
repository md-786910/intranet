import React, { useMemo, useState } from 'react';
import MessagesSidebar from './sidebar/MessagesSidebar';
import ConversationView from './conversation/ConversationView';
import { CONVERSATIONS } from './data';
import { useAuth } from '../../hooks/useAuth';

function nextId(messages) {
  return messages.reduce((max, m) => (m.id > max ? m.id : max), 0) + 1;
}

function nowTime() {
  return new Date().toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PeoplePage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0]?.id);
  // Mobile: when true, show conversation pane (hide sidebar)
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  const myInitials = useMemo(() => {
    const f = user?.first_name?.[0] || '';
    const l = user?.last_name?.[0] || '';
    const ji = (f + l).toUpperCase();
    return ji || (user?.email?.[0] || 'U').toUpperCase();
  }, [user]);

  const selected = conversations.find((c) => c.id === selectedId) || conversations[0];

  const handleSelect = (id) => {
    setSelectedId(id);
    setMobileShowConversation(true);
  };

  const handleSend = (text) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== selectedId) return c;
        const newMsg = {
          id: nextId(c.messages),
          from: 'me',
          text,
          at: nowTime(),
        };
        return {
          ...c,
          messages: [...c.messages, newMsg],
          preview: text,
          lastMessageAt: 'Just now',
        };
      }),
    );
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-unit-lg flex gap-gutter overflow-hidden h-[calc(100vh-11rem)]">
      <MessagesSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={handleSelect}
        className={`${mobileShowConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 shrink-0`}
      />
      <ConversationView
        conversation={selected}
        myInitials={myInitials}
        onSend={handleSend}
        onBack={() => setMobileShowConversation(false)}
        className={`${mobileShowConversation ? 'flex' : 'hidden lg:flex'} flex-grow`}
      />
    </main>
  );
}
