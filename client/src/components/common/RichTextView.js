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
  // Use innerHTML (not a React text node) so entities like &amp; decode to &.
  // safeHtml is already DOMPurify output, so it is safe to embed as HTML text.
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(safeHtml);
  if (!safeHtml) {
    return <p className={`text-gray-500 italic ${className}`}>No content yet.</p>;
  }
  const renderedHtml = looksLikeHtml
    ? safeHtml
    : `<p>${safeHtml.replace(/\n/g, '<br>')}</p>`;
  return (
    <div
      className={`prose prose-sm max-w-none${looksLikeHtml ? '' : ' whitespace-pre-wrap'} ${className}`.trim()}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
