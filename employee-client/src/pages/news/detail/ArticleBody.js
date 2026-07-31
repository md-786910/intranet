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

// Allow `class` so the drop-cap marker on the first <p> survives sanitize.
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

// Sanitize the article body and apply the .drop-cap to the first <p>.
export default function ArticleBody({ body }) {
  const html = useMemo(() => {
    if (!body) return '';
    const clean = DOMPurify.sanitize(body, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
    // Apply drop-cap to the first paragraph element only.
    return clean.replace(/<p(\s|>)/, '<p class="drop-cap"$1');
  }, [body]);

  if (!body) {
    return (
      <p className="font-body-lg text-body-lg text-on-surface-variant">
        This article has no content yet.
      </p>
    );
  }

  return (
    <div
      className="prose prose-zinc prose-lg max-w-none prose-p:leading-relaxed prose-headings:font-semibold font-body-lg text-body-lg text-on-surface-variant"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
