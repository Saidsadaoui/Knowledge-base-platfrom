import { isSupabaseConfigured, supabase } from './supabase';
import { itemsToCsv, matchesSearchQuery } from './searchAndExport';
import { detectSourceFromUrl, detectTypeFromUrl, normalizeUrlInput } from './urlUtils';
import type {
  Category,
  CreateItemInput,
  MetadataResult,
  Tag,
  UpdateItemInput,
  UserProfile,
  VaultItem,
} from './types';

export class ApiError extends Error {
  status: number;
  code?: string;
  existingItem?: VaultItem;

  constructor(message: string, status: number, code?: string, existingItem?: VaultItem) {
    super(message);
    this.status = status;
    this.code = code;
    this.existingItem = existingItem;
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'Vault');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Request failed',
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
      data.existingItem as VaultItem | undefined,
    );
  }
  return data as T;
}

async function getSupabaseUserId(): Promise<string> {
  if (!supabase) throw new ApiError('Supabase not configured', 500);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ApiError('Authentication required', 401);
  return data.user.id;
}

export async function getSession(): Promise<{ user: UserProfile | null; signedOut: boolean }> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return { user: null, signedOut: true };
    return {
      user: {
        id: u.id,
        email: u.email ?? '',
        name: typeof u.user_metadata?.full_name === 'string' ? u.user_metadata.full_name : undefined,
      },
      signedOut: false,
    };
  }
  return requestJson<{ user: UserProfile | null; signedOut: boolean }>('/api/auth/session');
}

export async function signInWithEmail(email: string): Promise<{ user?: UserProfile; magicLinkSent?: boolean }> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw new ApiError(error.message, 400);
    return { magicLinkSent: true };
  }
  return requestJson<{ user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function signInWithGoogle(): Promise<{ user?: UserProfile; redirecting?: boolean }> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new ApiError(error.message, 400);
    return { redirecting: true };
  }
  return requestJson<{ user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ls_sadaoui@esi.dz', name: 'Vault User' }),
  });
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
    return;
  }
  await requestJson('/api/auth/logout', { method: 'POST' });
}

export async function fetchMetadata(
  url: string,
): Promise<MetadataResult & { duplicateItem?: VaultItem | null }> {
  if (isSupabaseConfigured && supabase) {
    const res = await fetch('/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Vault' },
      body: JSON.stringify({ url }),
    });
    const normalized = normalizeUrlInput(url);
    if (!res.ok) {
      const source = detectSourceFromUrl(normalized);
      return {
        url: normalized,
        title: '',
        description: '',
        thumbnail_url: '',
        source,
        type: detectTypeFromUrl(normalized, source),
        fetchFailed: true,
        duplicateItem: null,
      };
    }
    return (await res.json()) as MetadataResult & { duplicateItem?: VaultItem | null };
  }

  return requestJson<MetadataResult & { duplicateItem?: VaultItem | null }>('/api/metadata', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function listCategories(): Promise<Category[]> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw new ApiError(error.message, 400);
    return (data ?? []) as Category[];
  }
  const res = await requestJson<{ categories: Category[] }>('/api/categories');
  return res.categories;
}

export async function createCategory(name: string): Promise<Category> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const existing = await listCategories();
    const maxPos = existing.reduce((m, c) => Math.max(m, c.position), -1);
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: name.trim(), position: maxPos + 1 })
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);
    return data as Category;
  }
  const res = await requestJson<{ category: Category }>('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return res.category;
}

export async function renameCategory(id: string, name: string): Promise<Category> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { data, error } = await supabase
      .from('categories')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);
    return data as Category;
  }
  const res = await requestJson<{ category: Category }>(`/api/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return res.category;
}

export async function reorderCategories(ids: string[]): Promise<Category[]> {
  if (isSupabaseConfigured && supabase) {
    const sb = supabase;
    const userId = await getSupabaseUserId();
    await Promise.all(
      ids.map((id, position) =>
        sb.from('categories').update({ position }).eq('id', id).eq('user_id', userId),
      ),
    );
    return listCategories();
  }
  const res = await requestJson<{ categories: Category[] }>('/api/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
  return res.categories;
}

export async function deleteCategory(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId);
    if (error) throw new ApiError(error.message, 400);
    return;
  }
  await requestJson(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listItems(): Promise<VaultItem[]> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { data, error } = await supabase
      .from('items')
      .select('*, item_tags(tags(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(error.message, 400);
    return (data ?? []).map((row: Record<string, unknown>) => {
      const joined = Array.isArray(row.item_tags) ? row.item_tags : [];
      const tags = joined
        .map((it: { tags?: { name?: string } | null }) => it.tags?.name)
        .filter((n: unknown): n is string => typeof n === 'string');
      const { item_tags: _ignored, ...rest } = row;
      return {
        ...(rest as Omit<VaultItem, 'tags'>),
        description: (rest.description as string) || '',
        thumbnail_url: (rest.thumbnail_url as string) || '',
        note: (rest.note as string) || '',
        tags,
      } as VaultItem;
    });
  }
  const res = await requestJson<{ items: VaultItem[] }>('/api/items?limit=10000');
  return res.items;
}

export async function searchItemsRemote(query: string): Promise<VaultItem[]> {
  if (isSupabaseConfigured && supabase) {
    const all = await listItems();
    return all.filter((i) => matchesSearchQuery(i, query));
  }
  const res = await requestJson<{ items: VaultItem[] }>(
    `/api/items?q=${encodeURIComponent(query)}&limit=1000`,
  );
  return res.items;
}

async function syncSupabaseItemTags(userId: string, itemId: string, tagNames: string[]): Promise<string[]> {
  if (!supabase) return [];
  const cleanNames = Array.from(new Set(tagNames.map((t) => t.trim()).filter(Boolean)));
  await supabase.from('item_tags').delete().eq('item_id', itemId);
  for (const name of cleanNames) {
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle();
    let tagId = existing?.id as string | undefined;
    if (!tagId) {
      const { data: created } = await supabase
        .from('tags')
        .insert({ user_id: userId, name })
        .select('id')
        .single();
      tagId = created?.id as string | undefined;
    }
    if (tagId) {
      await supabase.from('item_tags').insert({ item_id: itemId, tag_id: tagId });
    }
  }
  return cleanNames;
}

export async function createItem(input: CreateItemInput): Promise<VaultItem> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const normalizedUrl = normalizeUrlInput(input.url);
    const source = input.source ?? detectSourceFromUrl(normalizedUrl);
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        url: normalizedUrl,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        thumbnail_url: input.thumbnail_url ?? '',
        source,
        type: input.type,
        note: input.note?.trim() ?? '',
        category_id: input.category_id,
        status: input.status ?? 'todo',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: dup } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', userId)
          .eq('url', normalizedUrl)
          .maybeSingle();
        throw new ApiError('Already saved', 409, 'DUPLICATE_URL', dup as VaultItem | undefined);
      }
      throw new ApiError(error.message, 400);
    }

    const tags = input.tags?.length ? await syncSupabaseItemTags(userId, data.id, input.tags) : [];
    return { ...(data as VaultItem), tags };
  }

  const res = await requestJson<{ item: VaultItem }>('/api/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.item;
}

export async function updateItem(id: string, patch: UpdateItemInput): Promise<VaultItem> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { tags, ...rest } = patch;
    const { data, error } = await supabase
      .from('items')
      .update(rest)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);
    const resolvedTags =
      tags !== undefined ? await syncSupabaseItemTags(userId, id, tags) : undefined;
    return {
      ...(data as VaultItem),
      tags: resolvedTags ?? [],
    };
  }

  const res = await requestJson<{ item: VaultItem }>(`/api/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.item;
}

export async function deleteItem(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { error } = await supabase.from('items').delete().eq('id', id).eq('user_id', userId);
    if (error) throw new ApiError(error.message, 400);
    return;
  }
  await requestJson(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listTags(): Promise<Tag[]> {
  if (isSupabaseConfigured && supabase) {
    const userId = await getSupabaseUserId();
    const { data, error } = await supabase.from('tags').select('*').eq('user_id', userId);
    if (error) throw new ApiError(error.message, 400);
    return (data ?? []) as Tag[];
  }
  const res = await requestJson<{ tags: Tag[] }>('/api/tags');
  return res.tags;
}

export async function downloadExport(
  format: 'json' | 'csv',
  fallbackItems: VaultItem[],
  fallbackCategories: Category[],
): Promise<void> {
  let content: string;
  let mime: string;

  if (isSupabaseConfigured) {
    if (format === 'csv') {
      content = itemsToCsv(fallbackItems, fallbackCategories);
      mime = 'text/csv;charset=utf-8';
    } else {
      content = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          categories: fallbackCategories,
          items: fallbackItems,
        },
        null,
        2,
      );
      mime = 'application/json;charset=utf-8';
    }
  } else {
    const res = await fetch(`/api/export?format=${format}`, { credentials: 'include' });
    if (!res.ok) throw new ApiError('Export failed', res.status);
    content = await res.text();
    mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
  }

  const blob = new Blob([content], { type: mime });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `vault-export.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
