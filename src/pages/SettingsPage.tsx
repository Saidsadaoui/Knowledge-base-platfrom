import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Download, GripVertical, LogOut, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useRouter } from '../contexts/RouterContext';
import { useVault } from '../contexts/VaultContext';
import * as api from '../lib/api';

export function SettingsPage() {
  const { navigate } = useRouter();
  const {
    user,
    categories,
    items,
    addCategory,
    renameCategoryById,
    reorderCategoriesByIds,
    removeCategory,
    handleSignOut,
    showToast,
  } = useVault();

  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    try {
      await addCategory(trimmed);
      setNewCatName('');
      showToast('Category added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleRenameSave = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameCategoryById(id, trimmed);
      setEditingId(null);
      showToast('Renamed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const moveCategory = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((c) => c.id);
    const [removed] = ids.splice(index, 1);
    ids.splice(target, 0, removed);
    await reorderCategoriesByIds(ids);
  };

  const handleDropOn = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = categories.map((c) => c.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    setDraggedId(null);
    await reorderCategoriesByIds(ids);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(format);
    try {
      await api.downloadExport(format, items, categories);
      showToast(`Exported ${format.toUpperCase()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const onSignOut = async () => {
    await handleSignOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-[20px] font-semibold text-[var(--text)]">Settings</h1>

      {/* Manage Categories */}
      <section aria-labelledby="settings-categories" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="settings-categories" className="text-[14px] font-semibold text-[var(--text)]">
            Categories
          </h2>
          <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
            {categories.length}
          </span>
        </div>

        <form onSubmit={handleAddCategory} className="flex items-center gap-2">
          <label htmlFor="settings-new-category" className="sr-only">
            New category name
          </label>
          <input
            id="settings-new-category"
            type="text"
            dir="auto"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category..."
            className="flex-1 h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Add</span>
          </button>
        </form>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
          {categories.map((cat, idx) => {
            const count = items.filter((i) => i.category_id === cat.id).length;
            const isEditing = editingId === cat.id;
            const isDeleting = confirmDeleteId === cat.id;

            return (
              <div
                key={cat.id}
                draggable={!isEditing}
                onDragStart={() => setDraggedId(cat.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOn(cat.id)}
                onDragEnd={() => setDraggedId(null)}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                  draggedId === cat.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="text-[var(--text-muted)] cursor-grab hidden sm:inline-flex"
                    aria-hidden="true"
                  >
                    <GripVertical size={15} strokeWidth={1.75} />
                  </span>

                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRenameSave(cat.id);
                      }}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                    >
                      <label htmlFor={`rename-${cat.id}`} className="sr-only">
                        Rename {cat.name}
                      </label>
                      <input
                        id={`rename-${cat.id}`}
                        type="text"
                        dir="auto"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 min-w-0 h-8 px-2.5 rounded-[6px] border border-[var(--accent)] bg-[var(--surface)] text-[14px] text-[var(--text)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label={`Save ${cat.name}`}
                        className="p-1.5 rounded-[6px] bg-[var(--accent)] text-white dark:text-[#0C0A09]"
                      >
                        <Check size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel rename"
                        className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <X size={14} strokeWidth={1.75} />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span dir="auto" className="text-[14px] font-medium text-[var(--text)] truncate">
                        {cat.name}
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                        {count}
                      </span>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveCategory(idx, -1)}
                      aria-label={`Move ${cat.name} up`}
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === categories.length - 1}
                      onClick={() => moveCategory(idx, 1)}
                      aria-label={`Move ${cat.name} down`}
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      aria-label={`Rename ${cat.name}`}
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>

                    {!isDeleting ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(cat.id)}
                        aria-label={`Delete ${cat.name}`}
                        className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 pl-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await removeCategory(cat.id);
                            setConfirmDeleteId(null);
                            showToast('Category deleted');
                          }}
                          className="px-2.5 py-1 rounded-[6px] bg-[var(--danger)] text-white text-[12px] font-medium"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-[6px] border border-[var(--border)] text-[12px] text-[var(--text-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Export */}
      <section aria-labelledby="settings-export" className="space-y-3">
        <h2 id="settings-export" className="text-[14px] font-semibold text-[var(--text)]">
          Export
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
            className="h-9 px-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] inline-flex items-center gap-2 transition-colors"
          >
            <Download size={14} strokeWidth={1.75} />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
            className="h-9 px-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[13px] font-medium text-[var(--text)] inline-flex items-center gap-2 transition-colors"
          >
            <Download size={14} strokeWidth={1.75} />
            <span>Export CSV</span>
          </button>
        </div>
      </section>

      {/* Theme */}
      <section aria-labelledby="settings-theme" className="space-y-3">
        <h2 id="settings-theme" className="text-[14px] font-semibold text-[var(--text)]">
          Theme
        </h2>
        <ThemeToggle />
      </section>

      {/* Account */}
      <section aria-labelledby="settings-account" className="space-y-3 pt-2 border-t border-[var(--border)]">
        <h2 id="settings-account" className="text-[14px] font-semibold text-[var(--text)]">
          Account
        </h2>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-[var(--text-muted)] truncate">{user?.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="h-9 px-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--danger)] hover:text-[var(--danger)] text-[13px] font-medium text-[var(--text)] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <LogOut size={14} strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </div>
      </section>
    </div>
  );
}
