import React from 'react';
import type { ItemStatus, ItemType } from '../lib/types';

interface FilterBarProps {
  typeFilter: ItemType | 'all';
  onTypeChange: (val: ItemType | 'all') => void;
  statusFilter: ItemStatus | 'all';
  onStatusChange: (val: ItemStatus | 'all') => void;
  tagFilter: string;
  onTagChange: (val: string) => void;
  availableTags: string[];
}

const TYPE_OPTIONS: Array<{ value: ItemType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'post', label: 'Post' },
  { value: 'article', label: 'Article' },
  { value: 'ebook', label: 'Ebook' },
];

const STATUS_OPTIONS: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To watch' },
  { value: 'done', label: 'Done' },
];

export function FilterBar({
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  tagFilter,
  onTagChange,
  availableTags,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Filter by type"
        className="inline-flex items-center p-0.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] overflow-x-auto max-w-full"
      >
        {TYPE_OPTIONS.map((opt) => {
          const active = typeFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTypeChange(opt.value)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                active
                  ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex items-center p-0.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                active
                  ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {availableTags.length > 0 && (
        <div className="inline-flex items-center">
          <label htmlFor="filter-tag-select" className="sr-only">
            Filter by tag
          </label>
          <select
            id="filter-tag-select"
            dir="auto"
            value={tagFilter}
            onChange={(e) => onTagChange(e.target.value)}
            className="h-[30px] px-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-medium text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
          >
            <option value="">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
