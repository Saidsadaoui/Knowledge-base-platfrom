import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Pencil } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { ItemRow } from '../components/ItemRow';
import { SearchInput } from '../components/SearchInput';
import { useRouter } from '../contexts/RouterContext';
import { useVault } from '../contexts/VaultContext';
import { matchesSearchQuery } from '../lib/searchAndExport';
import type { ItemStatus, ItemType } from '../lib/types';

interface ListPageProps {
  mode: 'category' | 'inbox' | 'search';
  categoryId?: string;
}

const PAGE_SIZE = 50;

export function ListPage({ mode, categoryId }: ListPageProps) {
  const { search, navigate } = useRouter();
  const {
    categories,
    items,
    allTags,
    dataLoading,
    openQuickAdd,
    openItemDetail,
    toggleItemStatus,
    renameCategoryById,
    showToast,
  } = useVault();

  const urlParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialQuery = urlParams.get('q') ?? '';
  const initialStatusParam = urlParams.get('status');

  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>(
    initialStatusParam === 'todo' || initialStatusParam === 'done' ? initialStatusParam : 'all',
  );
  const [tagFilter, setTagFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery(urlParams.get('q') ?? '');
    const st = urlParams.get('status');
    setStatusFilter(st === 'todo' || st === 'done' ? st : 'all');
    setVisibleCount(PAGE_SIZE);
  }, [mode, categoryId, urlParams]);

  const activeCategory = useMemo(
    () => (mode === 'category' ? categories.find((c) => c.id === categoryId) ?? null : null),
    [mode, categories, categoryId],
  );

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  useEffect(() => {
    if (activeCategory) {
      setNameDraft(activeCategory.name);
      setEditingName(false);
    }
  }, [activeCategory?.id, activeCategory?.name]);

  const filteredItems = useMemo(() => {
    let list = items;

    if (mode === 'category') {
      list = list.filter((i) => i.category_id === categoryId);
    } else if (mode === 'inbox') {
      list = list.filter((i) => i.category_id === null);
    }

    if (mode === 'search' && query.trim()) {
      list = list.filter((i) => matchesSearchQuery(i, query));
    }

    if (typeFilter !== 'all') {
      list = list.filter((i) => i.type === typeFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (tagFilter) {
      list = list.filter((i) => i.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()));
    }

    return list;
  }, [items, mode, categoryId, query, typeFilter, statusFilter, tagFilter]);

  const pagedItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const hasFilters = typeFilter !== 'all' || statusFilter !== 'all' || Boolean(tagFilter);

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setTagFilter('');
    if (mode === 'search' && urlParams.has('status')) {
      navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search', { replace: true });
    }
  };

  const handleRenameSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeCategory) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === activeCategory.name) {
      setNameDraft(activeCategory.name);
      setEditingName(false);
      return;
    }
    try {
      await renameCategoryById(activeCategory.id, trimmed);
      setEditingName(false);
      showToast('Renamed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed');
      setNameDraft(activeCategory.name);
      setEditingName(false);
    }
  };

  const handleSearchChange = (nextQ: string) => {
    setQuery(nextQ);
    const nextParams = new URLSearchParams();
    if (nextQ.trim()) nextParams.set('q', nextQ.trim());
    if (statusFilter !== 'all') nextParams.set('status', statusFilter);
    const qs = nextParams.toString();
    navigate(qs ? `/search?${qs}` : '/search', { replace: true });
  };

  const pageTitle =
    mode === 'category'
      ? activeCategory?.name ?? 'Category'
      : mode === 'inbox'
        ? 'Inbox'
        : statusFilter === 'todo' && !query.trim()
          ? 'To watch'
          : 'Search';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Back to home"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors shrink-0"
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
            </button>

            {mode === 'category' && editingName ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 min-w-0">
                <label htmlFor="category-inline-rename" className="sr-only">
                  Category name
                </label>
                <input
                  id="category-inline-rename"
                  type="text"
                  dir="auto"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => handleRenameSubmit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setNameDraft(activeCategory?.name ?? '');
                      setEditingName(false);
                    }
                  }}
                  className="h-9 px-2.5 rounded-[8px] border border-[var(--accent)] bg-[var(--surface)] text-[20px] font-semibold text-[var(--text)] focus:outline-none min-w-[140px]"
                />
                <button
                  type="submit"
                  aria-label="Save category name"
                  className="p-2 rounded-[8px] bg-[var(--accent)] text-white dark:text-[#0C0A09]"
                >
                  <Check size={14} strokeWidth={2} />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1
                  dir="auto"
                  className="text-[20px] font-semibold text-[var(--text)] truncate"
                >
                  {pageTitle}
                </h1>
                {mode === 'category' && activeCategory && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label="Rename category"
                    className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="text-[13px] font-medium text-[var(--text-muted)] tabular-nums shrink-0">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {mode === 'search' && (
          <SearchInput
            value={query}
            onDebouncedChange={handleSearchChange}
            inputRef={searchInputRef}
            autoFocus
            placeholder="Search titles, notes, URLs, tags..."
          />
        )}

        <FilterBar
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          tagFilter={tagFilter}
          onTagChange={setTagFilter}
          availableTags={allTags}
        />
      </div>

      {/* Items List */}
      {dataLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-16 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] animate-pulse"
            />
          ))}
        </div>
      ) : pagedItems.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            {hasFilters
              ? 'No matching links.'
              : mode === 'search' && query.trim()
                ? `No results for "${query.trim()}".`
                : 'No links here yet.'}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] transition-colors"
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openQuickAdd()}
              className="h-9 px-4 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[13px] font-medium transition-colors"
            >
              Add link
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            {pagedItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                categoryName={
                  mode === 'category'
                    ? null
                    : item.category_id
                      ? categoryNameMap.get(item.category_id)
                      : 'Inbox'
                }
                searchQuery={mode === 'search' ? query : undefined}
                onOpen={(it) => openItemDetail(it.id)}
                onToggleStatus={toggleItemStatus}
              />
            ))}
          </div>

          {filteredItems.length > pagedItems.length && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="h-9 px-5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
