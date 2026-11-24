import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onDebouncedChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  id?: string;
}

export function SearchInput({
  value,
  onDebouncedChange,
  onSubmit,
  placeholder = 'Search library...',
  inputRef,
  autoFocus = false,
  id = 'vault-search-input',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localValue !== value) {
        onDebouncedChange(localValue);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [localValue, value, onDebouncedChange]);

  const handleClear = () => {
    setLocalValue('');
    onDebouncedChange('');
    inputRef?.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDebouncedChange(localValue);
        onSubmit?.(localValue);
      }}
      className="relative flex items-center"
    >
      <Search
        size={16}
        strokeWidth={1.75}
        className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none"
        aria-hidden="true"
      />
      <label htmlFor={id} className="sr-only">
        Search library
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="searchbox"
        dir="auto"
        autoFocus={autoFocus}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-14 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors duration-150"
      />
      {localValue ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="hidden sm:inline-flex items-center justify-center absolute right-3 px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)] rounded bg-[var(--surface-2)]"
        >
          /
        </kbd>
      )}
    </form>
  );
}
