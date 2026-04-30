import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'h2', 'h3',
  'blockquote',
  'a', 'img',
  'code', 'pre',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title'];

export default function RichTextView({ html, className = '' }) {
  const safeHtml = useMemo(() => {
    if (!html || typeof html !== 'string') return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  // Pre-rich-text articles whose body has no HTML render as plain paragraphs.
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(safeHtml);
  if (!safeHtml) {
    return <p className={`text-gray-500 italic ${className}`}>No content yet.</p>;
  }
  if (!looksLikeHtml) {
    return (
      <div className={`prose prose-sm max-w-none whitespace-pre-wrap ${className}`}>
        {safeHtml}
      </div>
    );
  }
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
