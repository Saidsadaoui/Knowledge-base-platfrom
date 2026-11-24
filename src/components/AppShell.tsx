import React, { useEffect } from 'react';
import { Folder, Home, Plus, Search, Settings, X } from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';
import { useVault } from '../contexts/VaultContext';
import { looksLikeUrl } from '../lib/urlUtils';
import { ItemDrawer } from './ItemDrawer';
import { QuickAddModal } from './QuickAddModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname, navigate } = useRouter();
  const {
    categories,
    items,
    openQuickAdd,
    closeQuickAdd,
    quickAddOpen,
    activeItemId,
    closeItemDetail,
    mobileCategoriesOpen,
    setMobileCategoriesOpen,
    toastMessage,
  } = useVault();

  // Global keyboard shortcuts: "/", "n", Cmd+V on Home, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickAddOpen) {
          closeQuickAdd();
          return;
        }
        if (activeItemId) {
          closeItemDetail();
          return;
        }
        if (mobileCategoriesOpen) {
          setMobileCategoriesOpen(false);
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable || quickAddOpen || activeItemId) return;

      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const searchEl = document.getElementById('vault-search-input') as HTMLInputElement | null;
        if (searchEl) {
          searchEl.focus();
        } else {
          navigate('/search');
          window.setTimeout(() => {
            const nextEl = document.getElementById('vault-search-input') as HTMLInputElement | null;
            nextEl?.focus();
          }, 50);
        }
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openQuickAdd();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (pathname !== '/' || quickAddOpen || activeItemId) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      const text = e.clipboardData?.getData('text') || '';
      if (looksLikeUrl(text)) {
        e.preventDefault();
        openQuickAdd(text);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [
    pathname,
    quickAddOpen,
    activeItemId,
    mobileCategoriesOpen,
    closeQuickAdd,
    closeItemDetail,
    setMobileCategoriesOpen,
    openQuickAdd,
    navigate,
  ]);

  const inboxCount = items.filter((i) => i.category_id === null).length;

  const navLinks = [
    { href: '/', label: 'Home', active: pathname === '/' },
    { href: '/inbox', label: 'Inbox', active: pathname === '/inbox' },
    { href: '/search', label: 'Search', active: pathname === '/search' },
    { href: '/settings', label: 'Settings', active: pathname === '/settings' },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top Bar: 3 zones (Wordmark — Nav links — 1 primary action) */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="max-w-[880px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="text-[16px] font-semibold tracking-tight text-[var(--text)] whitespace-nowrap shrink-0"
          >
            Vault
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(link.href);
                }}
                aria-current={link.active ? 'page' : undefined}
                className={`text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                  link.active
                    ? 'text-[var(--text)] underline decoration-[var(--accent)] decoration-2 underline-offset-8'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                navigate('/settings');
              }}
              aria-label="Settings"
              className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <Settings size={18} strokeWidth={1.75} />
            </a>
            <button
              type="button"
              onClick={() => openQuickAdd()}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-[#0C0A09] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150"
            >
              <Plus size={15} strokeWidth={2} />
              <span>Add link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[880px] mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Home, Search, Add, Categories) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-[var(--border)] bg-[var(--surface)] grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => {
            setMobileCategoriesOpen(false);
            navigate('/');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            pathname === '/' && !mobileCategoriesOpen
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Home size={18} strokeWidth={1.75} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileCategoriesOpen(false);
            navigate('/search');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            pathname === '/search' && !mobileCategoriesOpen
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Search size={18} strokeWidth={1.75} />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileCategoriesOpen(false);
            openQuickAdd();
          }}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <Plus size={18} strokeWidth={1.75} />
          <span>Add</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            mobileCategoriesOpen || pathname.startsWith('/c/') || pathname === '/inbox'
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Folder size={18} strokeWidth={1.75} />
          <span>Categories</span>
        </button>
      </nav>

      {/* Mobile Categories Sheet */}
      {mobileCategoriesOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 flex items-end"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileCategoriesOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
            className="w-full rounded-t-[16px] border-t border-[var(--border)] bg-[var(--surface)] p-5 pb-20 max-h-[75dvh] overflow-y-auto space-y-3"
          >
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[16px] font-semibold text-[var(--text)]">Categories</h2>
              <button
                type="button"
                onClick={() => setMobileCategoriesOpen(false)}
                aria-label="Close categories"
                className="p-2 rounded-[8px] text-[var(--text-muted)]"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileCategoriesOpen(false);
                  navigate('/inbox');
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[14px] font-medium"
              >
                <span>Inbox</span>
                <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{inboxCount}</span>
              </button>

              {categories.map((cat) => {
                const count = items.filter((i) => i.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setMobileCategoriesOpen(false);
                      navigate(`/c/${cat.id}`);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] font-medium"
                  >
                    <span dir="auto">{cat.name}</span>
                    <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <QuickAddModal />
      <ItemDrawer />

      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium shadow-md"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
