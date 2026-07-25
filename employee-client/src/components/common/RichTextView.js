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

export function plainTextFromHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function RichTextView({ html, className = '' }) {
  const safeHtml = useMemo(() => {
    if (!html || typeof html !== 'string') return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(safeHtml);
  if (!safeHtml) return null;
  if (!looksLikeHtml) {
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {safeHtml}
      </div>
    );
  }
  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
