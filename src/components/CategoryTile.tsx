import React from 'react';
import type { Category } from '../lib/types';

interface CategoryTileProps {
  category: Category;
  count: number;
  onClick: () => void;
}

export function CategoryTile({ category, count, onClick }: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left px-4 py-3.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] transition-colors duration-150 flex items-center justify-between gap-3 min-h-[48px]"
    >
      <span
        dir="auto"
        className="text-[14px] font-medium text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors duration-150"
      >
        {category.name}
      </span>
      <span className="text-[12px] font-medium text-[var(--text-muted)] tabular-nums shrink-0">
        {count}
      </span>
    </button>
  );
}
