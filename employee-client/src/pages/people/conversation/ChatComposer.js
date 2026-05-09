import React, { useState, useRef, useCallback, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';

export default function ChatComposer({ onSend, onTyping }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const toast = useToast();
  const typingRef = useRef(false);
  const typingTimer = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    setShowEmoji(false);

    // Stop typing indicator
    if (onTyping) {
      onTyping(false);
      typingRef.current = false;
    }
  };

  const handleChange = useCallback(
    (e) => {
      setText(e.target.value);

      if (!onTyping) return;

      // Emit typing start
      if (!typingRef.current) {
        typingRef.current = true;
        onTyping(true);
      }

      // Reset the stop-typing timer
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        typingRef.current = false;
        onTyping(false);
      }, 2000);
    },
    [onTyping],
  );

  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (file.type.startsWith('image/')) {
            onSend(`[IMAGE:${file.name}]${event.target.result}`);
          } else {
            onSend(`[FILE:${file.name}]${event.target.result}`);
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = null; // reset
    }
  };

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  return (
    <footer className="p-unit-lg bg-white border-t border-outline-variant shrink-0 relative">
      {/* Hidden file inputs */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        multiple
        accept="image/*"
        ref={imageInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Emoji Picker Popup */}
      {showEmoji && (
        <div className="absolute bottom-full left-4 mb-2 z-50 shadow-lg rounded-lg" ref={emojiPickerRef}>
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-unit-md bg-surface-container-low border border-outline-variant rounded-xl p-unit-sm shadow-inner"
      >
        <div className="flex gap-1 relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Add attachment"
          >
            <MaterialIcon name="attach_file" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Add image"
          >
            <MaterialIcon name="image" />
          </button>
          <button
            type="button"
            onClick={() => setShowEmoji((prev) => !prev)}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Emoji"
          >
            <MaterialIcon name="mood" />
          </button>
        </div>
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder="Type a message..."
          className="flex-grow bg-transparent border-none focus:ring-0 font-body-sm outline-none placeholder:text-outline"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-unit-lg py-2 bg-primary-container text-on-background font-semibold rounded-lg flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Send</span>
          <MaterialIcon name="send" className="text-sm" />
        </button>
      </form>
    </footer>
  );
}
