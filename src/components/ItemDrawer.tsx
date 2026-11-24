import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Trash2, X } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { formatRelativeDate } from '../lib/searchAndExport';
import type { ItemType } from '../lib/types';
import { isSafeExternalHref } from '../lib/urlUtils';
import { ItemThumbnail, SourceIcon } from './SourceIcon';
import { TagInput } from './TagInput';

export function ItemDrawer() {
  const {
    activeItemId,
    closeItemDetail,
    items,
    categories,
    allTags,
    editItem,
    removeItem,
    toggleItemStatus,
    showToast,
  } = useVault();

  const item = items.find((i) => i.id === activeItemId) ?? null;

  const [titleDraft, setTitleDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteSavedState, setNoteSavedState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!item) return;
    setTitleDraft(item.title);
    setNoteDraft(item.note);
    setCopied(false);
    setConfirmDelete(false);
    setNoteSavedState('idle');
  }, [item?.id, item?.title, item?.note]);

  if (!item) return null;

  const safeHref = isSafeExternalHref(item.url) ? item.url : '#';

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(item.title);
      return;
    }
    if (trimmed !== item.title) {
      await editItem(item.id, { title: trimmed });
      showToast('Updated');
    }
  };

  const saveNote = async () => {
    if (noteDraft === item.note) return;
    setNoteSavedState('saving');
    try {
      await editItem(item.id, { note: noteDraft });
      setNoteSavedState('saved');
      window.setTimeout(() => setNoteSavedState('idle'), 1500);
    } catch {
      setNoteSavedState('idle');
      showToast('Failed to save note');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Unable to copy link');
    }
  };

  const handleDelete = async () => {
    await removeItem(item.id);
    showToast('Deleted');
    closeItemDetail();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeItemDetail();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Item details"
        className="w-full md:max-w-[460px] h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <SourceIcon source={item.source} size={14} />
            <span>{item.source}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatRelativeDate(item.created_at)}</span>
          </div>
          <button
            type="button"
            onClick={closeItemDetail}
            aria-label="Close item details"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <ItemThumbnail
            src={item.thumbnail_url}
            alt={item.title || item.url}
            source={item.source}
            type={item.type}
            className="w-full aspect-video rounded-[10px]"
            iconSize={28}
          />

          {/* Editable Title */}
          <div className="space-y-1.5">
            <label htmlFor="detail-title" className="block text-[12px] font-medium text-[var(--text-muted)]">
              Title
            </label>
            <input
              id="detail-title"
              type="text"
              dir="auto"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[16px] font-semibold text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
            />
          </div>

          {/* URL + Open & Copy */}
          <div className="space-y-1.5">
            <span className="block text-[12px] font-medium text-[var(--text-muted)]">Link</span>
            <div className="flex items-center gap-2 p-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]">
              <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--text-muted)]">
                {item.url}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                aria-label="Copy link"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-medium text-[var(--text)] hover:border-[var(--accent)] whitespace-nowrap shrink-0 transition-colors"
              >
                {copied ? <Check size={13} strokeWidth={1.75} /> : <Copy size={13} strokeWidth={1.75} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Open</span>
                <ExternalLink size={13} strokeWidth={1.75} />
              </a>
            </div>
          </div>

          {/* Category, Type, Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="detail-category" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Category
              </label>
              <select
                id="detail-category"
                dir="auto"
                value={item.category_id ?? ''}
                onChange={(e) =>
                  editItem(item.id, { category_id: e.target.value || null })
                }
                className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                <option value="">Inbox</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="detail-type" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Type
              </label>
              <select
                id="detail-type"
                value={item.type}
                onChange={(e) => editItem(item.id, { type: e.target.value as ItemType })}
                className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                <option value="video">Video</option>
                <option value="post">Post</option>
                <option value="article">Article</option>
                <option value="ebook">Ebook</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] font-medium text-[var(--text-muted)]">Status</span>
            <button
              type="button"
              onClick={() => toggleItemStatus(item)}
              aria-pressed={item.status === 'done'}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] border text-[13px] font-medium transition-colors ${
                item.status === 'done'
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <Check size={14} strokeWidth={2} />
              <span>{item.status === 'done' ? 'Done' : 'To watch'}</span>
            </button>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label htmlFor="detail-tags" className="block text-[12px] font-medium text-[var(--text-muted)]">
              Tags
            </label>
            <TagInput
              id="detail-tags"
              tags={item.tags}
              onChange={(nextTags) => editItem(item.id, { tags: nextTags })}
              suggestions={allTags}
            />
          </div>

          {/* Note (autosave on blur, dir=auto) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="detail-note" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Note
              </label>
              {noteSavedState === 'saved' && (
                <span className="text-[12px] text-[var(--accent)]">Saved</span>
              )}
              {noteSavedState === 'saving' && (
                <span className="text-[12px] text-[var(--text-muted)]">Saving...</span>
              )}
            </div>
            <textarea
              id="detail-note"
              rows={3}
              dir="auto"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Write a note..."
              className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none resize-y transition-colors"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-3">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              <span>Delete</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-[8px] bg-[var(--danger)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-[8px] border border-[var(--border)] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={closeItemDetail}
            className="px-4 py-2 rounded-[8px] border border-[var(--border)] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}
