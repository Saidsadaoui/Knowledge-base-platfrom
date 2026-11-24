import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
  suggestions?: string[];
  id?: string;
  placeholder?: string;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  id = 'tag-input',
  placeholder = 'Add tag, press Enter',
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const clean = raw.trim().replace(/^#/, '');
    if (!clean) return;
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...tags, clean]);
    setDraft('');
  };

  const removeTag = (target: string) => {
    onChange(tags.filter((t) => t !== target));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const unusedSuggestions = suggestions
    .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
    .filter((s) => !draft.trim() || s.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--accent)] transition-colors duration-150">
        {tags.map((tag) => (
          <span
            key={tag}
            dir="auto"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--surface-2)] text-[12px] font-medium text-[var(--text)]"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-[var(--text-muted)] hover:text-[var(--text)] p-0.5 rounded transition-colors"
            >
              <X size={12} strokeWidth={1.75} />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) addTag(draft);
          }}
          placeholder={tags.length === 0 ? placeholder : 'Add tag...'}
          className="flex-1 min-w-[120px] bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
      </div>

      {draft.trim() && unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              dir="auto"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              className="px-2 py-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
