import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import CategoryCard from './CategoryCard';
import Skeleton from '../../../components/common/Skeleton';
import { themeForCategory } from '../data';
import { useDocumentsFilters } from '../FiltersContext';

// Prefer file count (matches the All Files grid inside the category). Fall
// back to doc_count if the API didn't include file_count for some reason.
function chipLabel(category) {
  const fileCount = Number(category?.file_count);
  if (Number.isFinite(fileCount) && fileCount > 0) {
    return `${fileCount} ${fileCount === 1 ? 'File' : 'Files'}`;
  }
  const docCount = Number(category?.doc_count) || 0;
  return `${docCount} ${docCount === 1 ? 'Doc' : 'Docs'}`;
}

export default function CategoryGrid({ categories, loading, error }) {
  const { filters } = useDocumentsFilters();

  const visible = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return (categories || []).filter((c) => {
      if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(c.category_id)) return false;
      if (term) {
        const haystack = `${c.name || ''} ${c.description || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [categories, filters]);

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

  if (!categories || categories.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-unit-xl text-center text-on-surface-variant">
        <p className="font-body text-body">No documents are available to you yet.</p>
        <p className="font-body-sm text-body-sm mt-1">
          When your team publishes documents to your department, vertical, or location, they'll show up here.
        </p>
      </section>
    );
  }

  if (visible.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-unit-lg text-center text-on-surface-variant">
        <p className="font-body-sm text-body-sm">No categories match your filters.</p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
      {visible.map((c) => {
        const theme = themeForCategory(c);
        const card = {
          id: c.category_id,
          name: c.name,
          desc: c.description || 'Documents in this category.',
          count: chipLabel(c),
          ...theme,
        };
        return (
          <Link key={c.category_id} to={`/documents/categories/${c.category_id}`} className="block">
            <CategoryCard category={card} />
          </Link>
        );
      })}
    </section>
  );
}
