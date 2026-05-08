import React from 'react';
import CategoryCard from './CategoryCard';
import { CATEGORIES } from '../data';

export default function CategoryGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
      {CATEGORIES.map((c) => (
        <CategoryCard key={c.id} category={c} />
      ))}
    </section>
  );
}
