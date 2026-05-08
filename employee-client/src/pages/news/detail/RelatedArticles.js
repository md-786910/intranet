import React, { useEffect, useState } from 'react';
import { newsService } from '../../../services/newsService';
import RelatedCard from '../../../components/news/RelatedCard';

export default function RelatedArticles({ ids }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ids || ids.length === 0) {
      setArticles([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(ids.slice(0, 3).map((id) => newsService.getArticle(id)))
      .then((results) => {
        if (cancelled) return;
        const loaded = results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value.data?.data || r.value.data)
          .filter(Boolean);
        setArticles(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (!ids || ids.length === 0) return null;
  if (!loading && articles.length === 0) return null;

  return (
    <section className="mt-unit-xxl pt-unit-xxl border-t border-outline-variant">
      <h2 className="font-h1 text-h1 text-on-background mb-unit-xl">
        Related Articles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {articles.map((a) => (
          <RelatedCard key={a.news_item_id} article={a} />
        ))}
      </div>
    </section>
  );
}
