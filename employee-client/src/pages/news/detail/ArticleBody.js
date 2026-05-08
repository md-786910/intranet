import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

// Sanitize the article body and apply the .drop-cap to the first <p>.
export default function ArticleBody({ body }) {
  const html = useMemo(() => {
    if (!body) return '';
    const clean = DOMPurify.sanitize(body, { USE_PROFILES: { html: true } });
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
      className="space-y-unit-md font-body-lg text-body-lg text-on-surface-variant leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
