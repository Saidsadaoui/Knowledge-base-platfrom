import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import * as api from '../lib/api';
import { ApiError } from '../lib/api';
import type { ItemType, SourceType, VaultItem } from '../lib/types';
import { detectSourceFromUrl, detectTypeFromUrl, isValidHttpUrl, normalizeUrlInput } from '../lib/urlUtils';
import { ItemThumbnail } from './SourceIcon';
import { TagInput } from './TagInput';

export function QuickAddModal() {
  const {
    quickAddOpen,
    quickAddInitialUrl,
    closeQuickAdd,
    categories,
    items,
    lastCategoryId,
    allTags,
    addItem,
    openItemDetail,
    showToast,
  } = useVault();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [source, setSource] = useState<SourceType>('web');
  const [type, setType] = useState<ItemType>('article');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<VaultItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchedUrlRef = useRef<string>('');

  const defaultCatId =
    lastCategoryId && categories.some((c) => c.id === lastCategoryId) ? lastCategoryId : '';

  const runMetadataFetch = async (rawUrl: string) => {
    const normalized = normalizeUrlInput(rawUrl);
    if (!isValidHttpUrl(normalized)) return;
    if (lastFetchedUrlRef.current === normalized) return;

    lastFetchedUrlRef.current = normalized;
    const detectedSource = detectSourceFromUrl(normalized);
    const detectedType = detectTypeFromUrl(normalized, detectedSource);
    setSource(detectedSource);
    setType(detectedType);
    setFetchingMeta(true);
    setFetchFailed(false);
    setErrorMsg(null);

    try {
      const res = await api.fetchMetadata(normalized);
      if (res.duplicateItem) {
        setDuplicateItem(res.duplicateItem);
      }
      setSource(res.source);
      setType(res.type);
      setDescription(res.description || '');
      setThumbnailUrl(res.thumbnail_url || '');
      if (res.title) {
        setTitle((prev) => (prev.trim() ? prev : res.title));
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
        window.setTimeout(() => titleInputRef.current?.focus(), 40);
      }
    } catch {
      setFetchFailed(true);
      window.setTimeout(() => titleInputRef.current?.focus(), 40);
    } finally {
      setFetchingMeta(false);
    }
  };

  // Instant duplicate detection & debounced metadata fetch when URL changes
  useEffect(() => {
    if (!quickAddOpen) return;
    const normalized = normalizeUrlInput(url);
    if (!isValidHttpUrl(normalized)) {
      setDuplicateItem(null);
      return;
    }
    const existing = items.find(
      (it) => it.url.toLowerCase() === normalized.toLowerCase(),
    );
    setDuplicateItem(existing ?? null);

    const timer = window.setTimeout(() => {
      runMetadataFetch(normalized);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [url, quickAddOpen, items]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const initUrl = quickAddInitialUrl ? normalizeUrlInput(quickAddInitialUrl) : '';
    setUrl(initUrl);
    setTitle('');
    setDescription('');
    setThumbnailUrl('');
    setSource(initUrl ? detectSourceFromUrl(initUrl) : 'web');
    setType(initUrl ? detectTypeFromUrl(initUrl) : 'article');
    setCategoryId(defaultCatId);
    setNote('');
    setTags([]);
    setFetchFailed(false);
    setDuplicateItem(null);
    setErrorMsg(null);
    setSaving(false);
    lastFetchedUrlRef.current = '';

    if (initUrl && isValidHttpUrl(initUrl)) {
      runMetadataFetch(initUrl);
    } else {
      window.setTimeout(() => urlInputRef.current?.focus(), 40);
    }
  }, [quickAddOpen, quickAddInitialUrl, defaultCatId]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);

    const normalized = normalizeUrlInput(url);
    if (!isValidHttpUrl(normalized)) {
      setErrorMsg('Enter a valid http or https link');
      urlInputRef.current?.focus();
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Title is required');
      titleInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await addItem({
        url: normalized,
        title: title.trim(),
        description,
        thumbnail_url: thumbnailUrl,
        source,
        type,
        note: note.trim(),
        category_id: categoryId || null,
        status: 'todo',
        tags,
      });
      showToast('Saved');
      closeQuickAdd();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.existingItem) {
        setDuplicateItem(err.existingItem);
        setErrorMsg('Already saved');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to save link');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  if (!quickAddOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeQuickAdd();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-heading"
        onKeyDown={handleKeyDown}
        className="w-full sm:max-w-[500px] rounded-t-[16px] sm:rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden animate-in fade-in duration-200 max-h-[92dvh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <h2 id="quick-add-heading" className="text-[16px] font-semibold text-[var(--text)]">
            Add link
          </h2>
          <button
            type="button"
            onClick={closeQuickAdd}
            aria-label="Close add link"
            className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {duplicateItem && (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)]/50 text-[13px]">
              <span className="font-medium text-[var(--text)]">Already saved</span>
              <button
                type="button"
                onClick={() => {
                  const id = duplicateItem.id;
                  closeQuickAdd();
                  openItemDetail(id);
                }}
                className="font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
              >
                Open item
              </button>
            </div>
          )}

          {errorMsg && !duplicateItem && (
            <p role="alert" className="text-[13px] font-medium text-[var(--danger)]">
              {errorMsg}
            </p>
          )}

          {/* 1. URL */}
          <div className="space-y-1.5">
            <label htmlFor="quick-add-url" className="block text-[12px] font-medium text-[var(--text-muted)]">
              URL
            </label>
            <div className="relative flex items-center">
              <input
                id="quick-add-url"
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted) {
                    setUrl(pasted);
                    runMetadataFetch(pasted);
                  }
                }}
                onBlur={() => {
                  if (url.trim()) runMetadataFetch(url);
                }}
                placeholder="https://..."
                required
                className="w-full h-10 pl-3 pr-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
              />
              {fetchingMeta && (
                <Loader2
                  size={14}
                  className="absolute right-3 animate-spin text-[var(--text-muted)] pointer-events-none"
                  aria-label="Fetching metadata"
                />
              )}
            </div>
          </div>

          {thumbnailUrl && (
            <div className="flex items-center gap-3 p-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]">
              <ItemThumbnail
                src={thumbnailUrl}
                alt={title || 'Link preview'}
                source={source}
                type={type}
                className="w-[72px] aspect-video rounded-[6px]"
              />
              <span className="text-[12px] text-[var(--text-muted)]">
                {source} · {type}
              </span>
            </div>
          )}

          {/* 2. Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="quick-add-title" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Title
              </label>
              {fetchFailed && !title.trim() && (
                <span className="text-[12px] text-[var(--text-muted)]">
                  Type title manually
                </span>
              )}
            </div>
            <input
              id="quick-add-title"
              ref={titleInputRef}
              type="text"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              required
              className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
            />
          </div>

          {/* 3. Category & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="quick-add-category" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Category
              </label>
              <select
                id="quick-add-category"
                dir="auto"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
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
              <label htmlFor="quick-add-type" className="block text-[12px] font-medium text-[var(--text-muted)]">
                Type
              </label>
              <select
                id="quick-add-type"
                value={type}
                onChange={(e) => setType(e.target.value as ItemType)}
                className="w-full h-10 px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
              >
                <option value="video">Video</option>
                <option value="post">Post</option>
                <option value="article">Article</option>
                <option value="ebook">Ebook</option>
              </select>
            </div>
          </div>

          {/* 4. Note */}
          <div className="space-y-1.5">
            <label htmlFor="quick-add-note" className="block text-[12px] font-medium text-[var(--text-muted)]">
              Note
            </label>
            <textarea
              id="quick-add-note"
              rows={2}
              dir="auto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none resize-y transition-colors duration-150"
            />
          </div>

          {/* 5. Tags */}
          <div className="space-y-1.5">
            <label htmlFor="quick-add-tags" className="block text-[12px] font-medium text-[var(--text-muted)]">
              Tags
            </label>
            <TagInput
              id="quick-add-tags"
              tags={tags}
              onChange={setTags}
              suggestions={allTags}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeQuickAdd}
              className="h-10 px-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[14px] font-medium disabled:opacity-60 transition-colors duration-150 inline-flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
