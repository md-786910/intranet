import React, { useEffect, useState } from 'react';
import CategoryCard from './CategoryCard';
import Skeleton from '../../../components/common/Skeleton';
import { documentsService } from '../../../services/documentsService';
import { themeForCategory } from '../data';

function pluralLabel(count) {
  return `${count} ${count === 1 ? 'Doc' : 'Docs'}`;
}

export default function CategoryGrid() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    documentsService
      .listCategories()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load categories.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg text-on-surface-variant text-body-sm">
        {error}
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-unit-xl text-center text-on-surface-variant">
        <p className="font-body text-body">No documents are available to you yet.</p>
        <p className="font-body-sm text-body-sm mt-1">
          When your team publishes documents to your department, vertical, or location, they'll show up here.
        </p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
      {categories.map((c) => {
        const theme = themeForCategory(c);
        const card = {
          id: c.category_id,
          name: c.name,
          desc: c.description || 'Documents in this category.',
          count: pluralLabel(c.doc_count || 0),
          ...theme,
        };
        return <CategoryCard key={c.category_id} category={card} />;
      })}
    </section>
  );
}
