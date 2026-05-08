import React, { useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';

export default function ChatComposer({ onSend }) {
  const [text, setText] = useState('');
  const toast = useToast();
  const stub = (label) => () => toast.info(`${label} coming soon.`);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  };

  return (
    <footer className="p-unit-lg bg-white border-t border-outline-variant shrink-0">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-unit-md bg-surface-container-low border border-outline-variant rounded-xl p-unit-sm shadow-inner"
      >
        <div className="flex gap-1">
          <button
            type="button"
            onClick={stub('Attachments')}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Add attachment"
          >
            <MaterialIcon name="add_circle" />
          </button>
          <button
            type="button"
            onClick={stub('Image upload')}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Add image"
          >
            <MaterialIcon name="image" />
          </button>
          <button
            type="button"
            onClick={stub('Emoji picker')}
            className="p-2 hover:bg-white rounded-lg transition-all text-outline"
            aria-label="Emoji"
          >
            <MaterialIcon name="mood" />
          </button>
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
