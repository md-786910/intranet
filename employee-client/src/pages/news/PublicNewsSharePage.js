import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Spinner from '../../components/common/Spinner';
import { newsService } from '../../services/newsService';
import { formatRelative } from '../../theme/dateFormat';

export default function PublicNewsSharePage() {
  const { token } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    newsService.getPublicShare(token)
      .then((res) => {
        if (cancelled) return;
        setArticle(res.data?.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 404
          ? 'This shared link is no longer valid.'
          : 'Could not load this article.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="border-b border-outline-variant bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon name="apartment" className="text-primary text-2xl" />
            <span className="text-xl font-bold">{article?.organisation_name || 'BrightNow'}</span>
          </div>
          <Link
            to="/login"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-primary-container text-on-background hover:opacity-80 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl">
        {loading && (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <MaterialIcon name="link_off" className="text-5xl text-on-surface-variant" />
            <h1 className="mt-unit-md font-h2 text-h2">Link unavailable</h1>
            <p className="mt-unit-sm text-secondary">{error}</p>
            <Link
              to="/login"
              className="inline-block mt-unit-lg px-6 py-2 rounded-lg bg-primary text-on-primary font-semibold"
            >
              Sign in to BrightNow
            </Link>
          </div>
        )}

        {!loading && !error && article && (
          <article>
            <h1 className="font-h1 text-h1 leading-tight mb-unit-md">{article.title}</h1>

            {article.summary && (
              <p className="text-body-lg text-secondary mb-unit-lg">{article.summary}</p>
            )}

            <div className="flex items-center gap-3 text-sm text-on-surface-variant mb-unit-lg">
              {article.author_name && <span>By {article.author_name}</span>}
              {article.published_at && <span>· {formatRelative(article.published_at)}</span>}
            </div>

            {article.cover_image_url && (
              <img
                src={article.cover_image_url}
                alt=""
                className="w-full rounded-2xl border border-outline-variant mb-unit-xl"
              />
            )}

            {article.body && (
              <div
                className="prose prose-zinc max-w-none"
                dangerouslySetInnerHTML={{ __html: article.body }}
              />
            )}

            <div className="mt-unit-xl pt-unit-lg border-t border-outline-variant text-center text-sm text-on-surface-variant">
              You're viewing a shared link.{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign in to BrightNow
              </Link>{' '}
              to interact with this article.
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
