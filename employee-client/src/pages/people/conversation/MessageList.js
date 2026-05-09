import React, { useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import DayDivider from './DayDivider';
import Skeleton from '../../../components/common/Skeleton';

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;

  messages.forEach((m) => {
    const msgDate = new Date(m.createdAt).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'divider', label: formatDateLabel(m.createdAt) });
    }
    groups.push({ type: 'message', data: m });
  });

  return groups;
}

function formatDateLabel(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  if (date.toDateString() === today) return 'Today';
  if (date.toDateString() === yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function MessageList({
  messages,
  contact,
  myInitials,
  myUserId,
  loading,
  hasMore,
  onLoadMore,
  typingUserId,
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const prevScrollHeight = useRef(0);
  const isInitialLoad = useRef(true);

  // Auto-scroll to bottom on new messages (but not on load-more)
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
      return;
    }

    // Check if user is near the bottom
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [contact?.userId]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !prevScrollHeight.current) return;
    const newScrollHeight = container.scrollHeight;
    container.scrollTop = newScrollHeight - prevScrollHeight.current;
    prevScrollHeight.current = 0;
  }, [messages.length]);

  // Scroll-up pagination
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || loading || !hasMore) return;

    if (container.scrollTop < 50) {
      prevScrollHeight.current = container.scrollHeight;
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  const grouped = groupMessagesByDate(messages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-grow overflow-y-auto p-unit-lg bg-surface chat-scrollbar flex flex-col gap-unit-md min-h-0"
    >
      {loading && hasMore && (
        <div className="flex justify-center py-2">
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          onClick={onLoadMore}
          className="self-center px-4 py-1.5 text-xs text-primary bg-primary-container/20 rounded-full hover:bg-primary-container/40 transition-colors"
        >
          Load older messages
        </button>
      )}

      {loading && messages.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 rounded-2xl self-end ml-auto" />
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-rounded text-4xl text-outline mb-2 block">
              waving_hand
            </span>
            <p className="text-body-sm text-on-surface-variant">
              Start the conversation by sending a message
            </p>
          </div>
        </div>
      ) : (
        grouped.map((item, idx) => {
          if (item.type === 'divider') {
            return <DayDivider key={`div-${idx}`} label={item.label} />;
          }
          return (
            <MessageBubble
              key={item.data.id}
              message={item.data}
              contact={contact}
              myInitials={myInitials}
              myUserId={myUserId}
            />
          );
        })
      )}

      {typingUserId && (
        <div className="flex items-center gap-2 pl-10">
          <div className="bg-white border border-outline-variant px-4 py-2 rounded-2xl rounded-bl-none shadow-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
