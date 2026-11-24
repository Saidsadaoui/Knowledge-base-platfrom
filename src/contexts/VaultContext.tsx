import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as api from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  Category,
  CreateItemInput,
  ThemePreference,
  UpdateItemInput,
  UserProfile,
  VaultItem,
} from '../lib/types';

const THEME_STORAGE_KEY = 'vault-theme';
const LAST_CAT_STORAGE_KEY = 'vault-last-category';

interface VaultContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  categories: Category[];
  items: VaultItem[];
  allTags: string[];
  dataLoading: boolean;
  dataError: string | null;
  theme: ThemePreference;
  setTheme: (pref: ThemePreference) => void;
  lastCategoryId: string | null;
  setLastCategoryId: (id: string | null) => void;
  quickAddOpen: boolean;
  quickAddInitialUrl: string;
  openQuickAdd: (initialUrl?: string) => void;
  closeQuickAdd: () => void;
  activeItemId: string | null;
  openItemDetail: (id: string) => void;
  closeItemDetail: () => void;
  mobileCategoriesOpen: boolean;
  setMobileCategoriesOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  homePasteInputRef: React.RefObject<HTMLInputElement | null>;
  refreshData: () => Promise<void>;
  handleSignInEmail: (email: string) => Promise<{ magicLinkSent?: boolean }>;
  handleSignInGoogle: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  addItem: (input: CreateItemInput) => Promise<VaultItem>;
  editItem: (id: string, patch: UpdateItemInput) => Promise<VaultItem>;
  removeItem: (id: string) => Promise<void>;
  toggleItemStatus: (item: VaultItem) => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  renameCategoryById: (id: string, name: string) => Promise<Category>;
  reorderCategoriesByIds: (ids: string[]) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function applyThemeToDom(pref: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = pref === 'dark' || (pref === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', shouldBeDark);
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // ignore
    }
    return 'system';
  });

  const [lastCategoryId, setLastCategoryIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_CAT_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialUrl, setQuickAddInitialUrl] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const homePasteInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemeState(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // ignore
    }
    applyThemeToDom(pref);
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeToDom('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setLastCategoryId = useCallback((id: string | null) => {
    setLastCategoryIdState(id);
    try {
      if (id) localStorage.setItem(LAST_CAT_STORAGE_KEY, id);
      else localStorage.removeItem(LAST_CAT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const refreshData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [cats, fetchedItems] = await Promise.all([api.listCategories(), api.listItems()]);
      setCategories(cats);
      setItems(fetchedItems);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await api.getSession();
        if (!active) return;
        setUser(session.user);
        if (session.user) {
          await refreshData();
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();

    if (isSupabaseConfigured && supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user;
        if (u) {
          setUser({
            id: u.id,
            email: u.email ?? '',
            name: typeof u.user_metadata?.full_name === 'string' ? u.user_metadata.full_name : undefined,
          });
          refreshData();
        } else {
          setUser(null);
          setCategories([]);
          setItems([]);
        }
      });
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      active = false;
    };
  }, [refreshData]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags) {
        set.add(tag);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const openQuickAdd = useCallback((initialUrl = '') => {
    setQuickAddInitialUrl(initialUrl);
    setQuickAddOpen(true);
  }, []);

  const closeQuickAdd = useCallback(() => {
    setQuickAddOpen(false);
    setQuickAddInitialUrl('');
    window.setTimeout(() => {
      homePasteInputRef.current?.focus();
    }, 60);
  }, []);

  const openItemDetail = useCallback((id: string) => {
    setActiveItemId(id);
  }, []);

  const closeItemDetail = useCallback(() => {
    setActiveItemId(null);
  }, []);

  const handleSignInEmail = useCallback(
    async (email: string) => {
      const res = await api.signInWithEmail(email);
      if (res.user) {
        setUser(res.user);
        await refreshData();
      }
      return { magicLinkSent: res.magicLinkSent };
    },
    [refreshData],
  );

  const handleSignInGoogle = useCallback(async () => {
    const res = await api.signInWithGoogle();
    if (res.user) {
      setUser(res.user);
      await refreshData();
    }
  }, [refreshData]);

  const handleSignOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
    setCategories([]);
    setItems([]);
    setActiveItemId(null);
    setQuickAddOpen(false);
  }, []);

  const addItem = useCallback(
    async (input: CreateItemInput) => {
      const created = await api.createItem(input);
      setItems((prev) => [created, ...prev]);
      setLastCategoryId(created.category_id);
      return created;
    },
    [setLastCategoryId],
  );

  const editItem = useCallback(async (id: string, patch: UpdateItemInput) => {
    const updated = await api.updateItem(id, patch);
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    return updated;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    setActiveItemId((cur) => (cur === id ? null : cur));
  }, []);

  const toggleItemStatus = useCallback(
    async (item: VaultItem) => {
      const nextStatus = item.status === 'done' ? 'todo' : 'done';
      // Optimistic update
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it)));
      try {
        const updated = await api.updateItem(item.id, { status: nextStatus });
        setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      } catch (err) {
        // Revert on error
        setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
        showToast(err instanceof Error ? err.message : 'Failed to update status');
      }
    },
    [showToast],
  );

  const addCategory = useCallback(async (name: string) => {
    const created = await api.createCategory(name);
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const renameCategoryById = useCallback(async (id: string, name: string) => {
    const updated = await api.renameCategory(id, name);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const reorderCategoriesByIds = useCallback(
    async (ids: string[]) => {
      const prevCats = categories;
      const map = new Map(categories.map((c) => [c.id, c]));
      const reordered = ids
        .map((id, idx) => {
          const cat = map.get(id);
          return cat ? { ...cat, position: idx } : null;
        })
        .filter((c): c is Category => c !== null);
      setCategories(reordered);
      try {
        const saved = await api.reorderCategories(ids);
        setCategories(saved);
      } catch (err) {
        setCategories(prevCats);
        showToast(err instanceof Error ? err.message : 'Failed to reorder categories');
      }
    },
    [categories, showToast],
  );

  const removeCategory = useCallback(async (id: string) => {
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) =>
      prev.map((it) => (it.category_id === id ? { ...it, category_id: null } : it)),
    );
  }, []);

  return (
    <VaultContext.Provider
      value={{
        user,
        authLoading,
        categories,
        items,
        allTags,
        dataLoading,
        dataError,
        theme,
        setTheme,
        lastCategoryId,
        setLastCategoryId,
        quickAddOpen,
        quickAddInitialUrl,
        openQuickAdd,
        closeQuickAdd,
        activeItemId,
        openItemDetail,
        closeItemDetail,
        mobileCategoriesOpen,
        setMobileCategoriesOpen,
        toastMessage,
        showToast,
        homePasteInputRef,
        refreshData,
        handleSignInEmail,
        handleSignInGoogle,
        handleSignOut,
        addItem,
        editItem,
        removeItem,
        toggleItemStatus,
        addCategory,
        renameCategoryById,
        reorderCategoriesByIds,
        removeCategory,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
}
