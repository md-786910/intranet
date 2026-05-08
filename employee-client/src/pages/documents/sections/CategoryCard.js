import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function CategoryCard({ category }) {
  const c = category;
  return (
    <button
      type="button"
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow group cursor-pointer text-left flex flex-col"
    >
      <div
        className={`w-12 h-12 ${c.iconBg} rounded-lg flex items-center justify-center mb-4 ${c.iconHoverBg} transition-colors`}
      >
        <MaterialIcon
          name={c.icon}
          className={c.iconColor}
          style={{ fontVariationSettings: '"FILL" 1' }}
        />
      </div>
      <h3 className="font-h3 text-h3 text-on-background mb-2">{c.name}</h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 line-clamp-2">
        {c.desc}
      </p>
      <div className="flex items-center justify-between mt-auto">
        <span
          className={`font-label-caps text-label-caps ${c.countText} ${c.countBg} px-2 py-1 rounded`}
        >
          {c.count}
        </span>
        <MaterialIcon
          name="arrow_forward"
          className={`text-outline-variant ${c.arrowHover} transition-colors`}
        />
      </div>
    </button>
  );
}
