import React from 'react';
import { categoryPalette } from '../../theme/categoryColors';

// Two visual variants:
//   solid — filled chip used in featured / detail headers
//   tag   — just the uppercase coloured text (used in small list cards)
export default function CategoryPill({ category, variant = 'tag', className = '' }) {
  if (!category) return null;
  const palette = categoryPalette(category);
  const label = category.toUpperCase();

  if (variant === 'solid') {
    return (
      <span
        className={`inline-block ${palette.solidBg} ${palette.solidText} font-label-caps text-label-caps px-unit-md py-1 rounded-full ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`text-[10px] font-bold ${palette.text} uppercase tracking-widest ${className}`}
    >
      {label}
    </span>
  );
}
