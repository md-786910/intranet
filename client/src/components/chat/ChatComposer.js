import React, { useCallback, useEffect, useRef, useState } from 'react';

export default function ChatComposer({ onSend, onTyping, disabled, placeholder }) {
  const [text, setText] = useState('');
  const typingRef = useRef(false);
  const typingTimer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const submit = (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend?.(value);
    setText('');
    if (onTyping) {
      onTyping(false);
      typingRef.current = false;
    }
    inputRef.current?.focus();
  };

  const handleChange = useCallback(
    (e) => {
      setText(e.target.value);
      if (!onTyping || disabled) return;
      if (!typingRef.current) {
        typingRef.current = true;
        onTyping(true);
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        typingRef.current = false;
        onTyping(false);
      }, 2000);
    },
    [onTyping, disabled],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-gray-200 bg-white p-3 shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder || 'Type a message…'}
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 disabled:opacity-60 max-h-28"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label="Send message"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </form>
  );
}
