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

  // Plain-text fallback uses innerHTML so entities like &amp; decode to &.
  // safeHtml is already DOMPurify output, so it is safe to embed as HTML text.
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(safeHtml);
  if (!safeHtml) return null;
  const renderedHtml = looksLikeHtml
    ? safeHtml
    : `<p>${safeHtml.replace(/\n/g, '<br>')}</p>`;
  return (
    <div
      className={`${looksLikeHtml ? '' : 'whitespace-pre-wrap '}${className}`.trim()}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
