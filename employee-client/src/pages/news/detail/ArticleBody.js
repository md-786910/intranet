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

/** Shared reading typography for news detail + public share pages. */
export const ARTICLE_BODY_CLASS =
  'article-body prose prose-zinc prose-lg max-w-none ' +
  'prose-p:leading-[1.75] prose-p:my-5 ' +
  'prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-h2:font-semibold ' +
  'prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl prose-h3:font-semibold ' +
  'prose-ul:my-5 prose-ol:my-5 prose-ul:pl-6 prose-ol:pl-6 ' +
  'prose-li:my-2 prose-li:leading-relaxed ' +
  'prose-ul:marker:text-on-surface-variant ' +
  'prose-blockquote:my-6 prose-img:my-6 ' +
  'font-body-lg text-body-lg text-on-surface-variant';

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
      className={ARTICLE_BODY_CLASS}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
