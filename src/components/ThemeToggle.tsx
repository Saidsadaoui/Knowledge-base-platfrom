import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import type { ThemePreference } from '../lib/types';

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useVault();

  return (
    <div
      role="group"
      aria-label="Theme preference"
      className="inline-flex items-center p-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
              active
                ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent'
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
