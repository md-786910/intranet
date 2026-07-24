import React, { useCallback, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - target) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;
  messages.forEach((m) => {
    const msgDate = new Date(m.createdAt || m.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'divider', label: formatDateLabel(m.createdAt || m.created_at) });
    }
    groups.push({ type: 'message', data: m });
  });
  return groups;
}

export default function MessageList({
  messages,
  loading,
  hasMore,
  onLoadMore,
  typing,
  myUserId,
  myInitials,
  contactInitials,
  contactAvatar,
  conversationKey,
}) {
  const containerRef = useRef(null);
  const prevScrollHeight = useRef(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isInitialLoad.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
      isInitialLoad.current = false;
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, typing]);

  useEffect(() => {
    isInitialLoad.current = true;
  }, [conversationKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !prevScrollHeight.current) return;
    container.scrollTop = container.scrollHeight - prevScrollHeight.current;
    prevScrollHeight.current = 0;
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || loading || !hasMore) return;
    if (container.scrollTop < 40) {
      prevScrollHeight.current = container.scrollHeight;
      onLoadMore?.();
    }
  }, [loading, hasMore, onLoadMore]);

  const grouped = groupMessagesByDate(messages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-gray-50 flex flex-col gap-3"
    >
      {hasMore && !loading && (
        <button
          type="button"
          onClick={onLoadMore}
          className="self-center text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1 rounded-full bg-white border border-gray-200"
        >
          Load older messages
        </button>
      )}

      {loading && messages.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 w-3/4 bg-gray-200 rounded-2xl" />
          <div className="h-10 w-1/2 bg-gray-200 rounded-2xl self-end ml-auto" />
          <div className="h-10 w-2/3 bg-gray-200 rounded-2xl" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div>
            <p className="text-sm font-medium text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-500 mt-1">Send a message to start the conversation.</p>
          </div>
        </div>
      ) : (
        grouped.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <div key={`d-${idx}`} className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            );
          }
          return (
            <MessageBubble
              key={item.data.id}
              message={item.data}
              myUserId={myUserId}
              myInitials={myInitials}
              contactInitials={contactInitials}
              contactAvatar={contactAvatar}
            />
          );
        })
      )}

      {typing && (
        <div className="flex items-center gap-2 pl-9">
          <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md shadow-sm">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
