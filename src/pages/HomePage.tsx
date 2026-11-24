import React, { useMemo, useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import { CategoryTile } from '../components/CategoryTile';
import { ItemRow } from '../components/ItemRow';
import { SearchInput } from '../components/SearchInput';
import { useRouter } from '../contexts/RouterContext';
import { useVault } from '../contexts/VaultContext';
import { looksLikeUrl } from '../lib/urlUtils';

export function HomePage() {
  const { navigate } = useRouter();
  const {
    categories,
    items,
    dataLoading,
    openQuickAdd,
    openItemDetail,
    toggleItemStatus,
    addCategory,
    homePasteInputRef,
    showToast,
  } = useVault();

  const [pasteValue, setPasteValue] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.category_id) {
        map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1);
      }
    }
    return map;
  }, [items]);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const inboxCount = useMemo(() => items.filter((i) => i.category_id === null).length, [items]);
  const todoCount = useMemo(() => items.filter((i) => i.status === 'todo').length, [items]);
  const recentItems = useMemo(() => items.slice(0, 10), [items]);

  const handlePasteInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = pasteValue.trim();
    if (!val) {
      openQuickAdd();
      return;
    }
    if (looksLikeUrl(val)) {
      setPasteValue('');
      openQuickAdd(val);
    } else {
      navigate(`/search?q=${encodeURIComponent(val)}`);
    }
  };

  const handleCreateCategory = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setCatError(null);
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCreatingCat(false);
      return;
    }
    try {
      await addCategory(trimmed);
      setNewCatName('');
      setCreatingCat(false);
      showToast('Category added');
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  return (
    <div className="space-y-8">
      {/* Command Paste Input + Search */}
      <section aria-label="Quick capture and search" className="space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">Library</h1>

        <form onSubmit={handlePasteInputSubmit} className="relative flex items-center">
          <Link2
            size={16}
            strokeWidth={1.75}
            className="absolute left-3.5 text-[var(--accent)] pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="home-paste-input" className="sr-only">
            Paste a link
          </label>
          <input
            id="home-paste-input"
            ref={homePasteInputRef}
            type="text"
            autoFocus
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (looksLikeUrl(pasted)) {
                e.preventDefault();
                setPasteValue('');
                openQuickAdd(pasted);
              }
            }}
            placeholder="Paste a link..."
            className="w-full h-11 pl-10 pr-20 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
          />
          {pasteValue.trim() && (
            <button
              type="submit"
              className="absolute right-2 px-3 py-1.5 rounded-[6px] bg-[var(--accent)] text-white dark:text-[#0C0A09] text-[12px] font-medium"
            >
              Add
            </button>
          )}
        </form>

        <SearchInput
          value=""
          onDebouncedChange={(q) => {
            if (q.trim()) {
              navigate(`/search?q=${encodeURIComponent(q.trim())}`);
            }
          }}
          onSubmit={(q) => {
            navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
          }}
          placeholder="Search links, notes, tags..."
        />

        {/* Small chips row: Inbox & To watch */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] transition-colors duration-150"
          >
            <span>Inbox</span>
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{inboxCount}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/search?status=todo')}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] transition-colors duration-150"
          >
            <span>To watch</span>
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{todoCount}</span>
          </button>
        </div>
      </section>

      {/* Categories Grid */}
      <section aria-labelledby="categories-heading" className="space-y-3">
        <h2 id="categories-heading" className="text-[14px] font-semibold text-[var(--text-muted)]">
          Categories
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {categories.map((cat) => (
            <CategoryTile
              key={cat.id}
              category={cat}
              count={categoryCounts.get(cat.id) ?? 0}
              onClick={() => navigate(`/c/${cat.id}`)}
            />
          ))}

          {!creatingCat ? (
            <button
              type="button"
              onClick={() => {
                setCatError(null);
                setCreatingCat(true);
              }}
              className="w-full px-4 py-3.5 rounded-[10px] border border-dashed border-[var(--border)] bg-transparent hover:border-[var(--accent)] text-[14px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors duration-150 flex items-center justify-center gap-1.5 min-h-[48px]"
            >
              <Plus size={15} strokeWidth={1.75} />
              <span>New</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateCategory}
              className="col-span-2 sm:col-span-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-[var(--accent)] bg-[var(--surface)] min-h-[48px]"
            >
              <label htmlFor="new-category-inline" className="sr-only">
                New category name
              </label>
              <input
                id="new-category-inline"
                type="text"
                dir="auto"
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setCreatingCat(false);
                    setNewCatName('');
                    setCatError(null);
                  }
                }}
                placeholder="Category name"
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-[6px] bg-[var(--accent)] text-white dark:text-[#0C0A09] text-[12px] font-medium shrink-0"
              >
                Add
              </button>
            </form>
          )}
        </div>

        {catError && (
          <p role="alert" className="text-[13px] font-medium text-[var(--danger)]">
            {catError}
          </p>
        )}
      </section>

      {/* Recently Added */}
      <section aria-labelledby="recent-heading" className="space-y-2">
        <h2 id="recent-heading" className="text-[14px] font-semibold text-[var(--text-muted)]">
          Recently added
        </h2>

        {dataLoading ? (
          <div className="space-y-3 pt-1" aria-busy="true" aria-label="Loading items">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] animate-pulse"
              />
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="py-10 text-center space-y-3 border border-[var(--border)] rounded-[10px] bg-[var(--surface)]">
            <p className="text-[14px] text-[var(--text-muted)]">No links saved yet.</p>
            <button
              type="button"
              onClick={() => openQuickAdd()}
              className="h-9 px-4 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[13px] font-medium transition-colors"
            >
              Add link
            </button>
          </div>
        ) : (
          <div className="divide-y divide-transparent">
            {recentItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                categoryName={item.category_id ? categoryNameMap.get(item.category_id) : 'Inbox'}
                onOpen={(it) => openItemDetail(it.id)}
                onToggleStatus={toggleItemStatus}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
