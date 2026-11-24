import React from 'react';
import { Check } from 'lucide-react';
import { formatRelativeDate, highlightMatchSegments } from '../lib/searchAndExport';
import type { VaultItem } from '../lib/types';
import { ItemThumbnail, SourceIcon } from './SourceIcon';

interface ItemRowProps {
  item: VaultItem;
  categoryName?: string | null;
  searchQuery?: string;
  onOpen: (item: VaultItem) => void;
  onToggleStatus: (item: VaultItem) => void;
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;
  const segments = highlightMatchSegments(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="bg-[var(--accent-soft)] text-[var(--text)] rounded-[3px] px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </>
  );
}

export function ItemRow({
  item,
  categoryName,
  searchQuery,
  onOpen,
  onToggleStatus,
}: ItemRowProps) {
  const isDone = item.status === 'done';
  const displayTitle = item.title || item.url;

  return (
    <div className="group flex items-center gap-3.5 py-3 px-2 -mx-2 rounded-[10px] hover:bg-[var(--surface-2)]/70 transition-colors duration-150 border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex-1 min-w-0 flex items-center gap-3.5 text-left focus-visible:outline-none"
      >
        <ItemThumbnail
          src={item.thumbnail_url}
          alt={displayTitle}
          source={item.source}
          type={item.type}
          className="w-[72px] aspect-video rounded-[6px]"
          iconSize={16}
        />

        <div className="flex-1 min-w-0 space-y-1">
          <div
            dir="auto"
            className={`text-[16px] font-medium leading-[1.35] line-clamp-2 ${
              isDone ? 'text-[var(--text-muted)] line-through decoration-[var(--border)]' : 'text-[var(--text)]'
            }`}
          >
            <HighlightedText text={displayTitle} query={searchQuery} />
          </div>

          {searchQuery?.trim() && item.note && (
            <p dir="auto" className="text-[12px] text-[var(--text-muted)] line-clamp-1">
              <HighlightedText text={item.note} query={searchQuery} />
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <SourceIcon source={item.source} size={12} />
              <span>{item.source}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{item.type}</span>
            {categoryName && (
              <>
                <span aria-hidden="true">·</span>
                <span dir="auto" className="truncate max-w-[140px]">
                  {categoryName}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatRelativeDate(item.created_at)}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? `Mark "${displayTitle}" as to watch` : `Mark "${displayTitle}" as done`}
        onClick={() => onToggleStatus(item)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 rounded-[8px] hover:bg-[var(--surface)] transition-colors duration-150"
      >
        <span
          className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-150 ${
            isDone
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white dark:text-[#0C0A09]'
              : 'border-[var(--border)] bg-[var(--surface)] group-hover:border-[var(--text-muted)]'
          }`}
        >
          {isDone && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
        </span>
      </button>
    </div>
  );
}
