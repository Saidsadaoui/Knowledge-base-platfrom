import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { matchesSearchQuery } from '../src/lib/searchAndExport';
import { detectSourceFromUrl, detectTypeFromUrl, isValidHttpUrl, normalizeUrlInput } from '../src/lib/urlUtils';
import type {
  Category,
  CreateItemInput,
  ItemStatus,
  ItemType,
  Tag,
  UpdateItemInput,
  UserProfile,
  VaultItem,
} from '../src/lib/types';

interface StoredItemRecord {
  id: string;
  user_id: string;
  url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  source: VaultItem['source'];
  type: ItemType;
  note: string;
  category_id: string | null;
  status: ItemStatus;
  created_at: string;
}

interface StoredItemTag {
  item_id: string;
  tag_id: string;
}

interface VaultDatabase {
  users: Array<UserProfile & { created_at: string }>;
  categories: Category[];
  items: StoredItemRecord[];
  tags: Tag[];
  item_tags: StoredItemTag[];
}

export const DEFAULT_CATEGORY_NAMES = [
  'Quran',
  'AI',
  'English',
  'Discipline',
  'Ahadith Nabawiya',
] as const;

export const DEFAULT_PREVIEW_EMAIL = 'ls_sadaoui@esi.dz';

export class StoreError extends Error {
  status: number;
  code?: string;
  existingItem?: VaultItem;

  constructor(message: string, status = 400, code?: string, existingItem?: VaultItem) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.code = code;
    this.existingItem = existingItem;
  }
}

export class VaultStore {
  private dbPath: string;
  private db: VaultDatabase;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? path.resolve(process.cwd(), 'data', 'vault-db.json');
    this.db = this.load();
    this.ensureDefaultPreviewUser();
  }

  private load(): VaultDatabase {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<VaultDatabase>;
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          items: Array.isArray(parsed.items) ? parsed.items : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          item_tags: Array.isArray(parsed.item_tags) ? parsed.item_tags : [],
        };
      }
    } catch {
      // Corrupt or unreadable DB file falls back to empty state
    }
    return { users: [], categories: [], items: [], tags: [], item_tags: [] };
  }

  private save(): void {
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.dbPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmp, this.dbPath);
  }

  private ensureDefaultPreviewUser(): void {
    const existing = this.db.users.find((u) => u.email.toLowerCase() === DEFAULT_PREVIEW_EMAIL);
    if (existing) return;

    const user = this.findOrCreateUser(DEFAULT_PREVIEW_EMAIL, 'Vault User');
    const cats = this.listCategories(user.id);
    const byName = new Map(cats.map((c) => [c.name, c.id]));

    const starterItems: CreateItemInput[] = [
      {
        url: 'https://www.anthropic.com/research/building-effective-agents',
        title: 'Building Effective Agents — Anthropic',
        description: 'Practical patterns for tool use, routing, and agentic workflows.',
        source: 'web',
        type: 'article',
        note: 'AI skills for agentic agents: start with simple composable patterns before frameworks.',
        category_id: byName.get('AI') ?? null,
        status: 'todo',
        tags: ['agents', 'llm'],
      },
      {
        url: 'https://sunnah.com/nawawi40',
        title: 'الأربعون النووية — Forty Hadith of al-Nawawi',
        description: 'Essential collection of prophetic traditions.',
        source: 'web',
        type: 'article',
        note: 'مراجعة حديث إنما الأعمال بالنيات يومياً قبل بدء العمل',
        category_id: byName.get('Ahadith Nabawiya') ?? null,
        status: 'todo',
        tags: ['hadith', 'إخلاص'],
      },
      {
        url: 'https://www.youtube.com/watch?v=hu-q2zYwEYs',
        title: 'Deep Focus & Deliberate Practice Habits',
        description: 'Building consistent daily study routines.',
        source: 'youtube',
        type: 'video',
        note: '90-minute morning focus block without phone.',
        category_id: byName.get('Discipline') ?? null,
        status: 'done',
        tags: ['habits'],
      },
      {
        url: 'https://en.wikipedia.org/wiki/Spaced_repetition',
        title: 'Spaced repetition — Wikipedia',
        description: 'Evidence-based learning technique using increasing intervals.',
        source: 'web',
        type: 'article',
        note: 'Apply to Arabic and English vocabulary review.',
        category_id: null,
        status: 'todo',
        tags: ['learning'],
      },
    ];

    for (const item of starterItems) {
      try {
        this.createItem(user.id, item);
      } catch {
        // Ignore if already exists
      }
    }
  }

  public findOrCreateUser(email: string, name?: string): UserProfile {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new StoreError('Valid email is required', 400);
    }

    let user = this.db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        name: name?.trim() || cleanEmail.split('@')[0],
        created_at: new Date().toISOString(),
      };
      this.db.users.push(user);
      this.seedDefaultCategories(user.id);
      this.save();
    } else {
      // Ensure default categories exist on first login if user has none yet
      const userCats = this.db.categories.filter((c) => c.user_id === user!.id);
      if (userCats.length === 0) {
        this.seedDefaultCategories(user.id);
        this.save();
      }
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  public getUserById(userId: string): UserProfile | null {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  public seedDefaultCategories(userId: string): void {
    const now = new Date().toISOString();
    DEFAULT_CATEGORY_NAMES.forEach((name, idx) => {
      const exists = this.db.categories.some(
        (c) => c.user_id === userId && c.name.toLowerCase() === name.toLowerCase(),
      );
      if (!exists) {
        this.db.categories.push({
          id: crypto.randomUUID(),
          user_id: userId,
          name,
          position: idx,
          created_at: now,
        });
      }
    });
  }

  public listCategories(userId: string): Category[] {
    return this.db.categories
      .filter((c) => c.user_id === userId)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  public createCategory(userId: string, name: string): Category {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new StoreError('Category name is required', 400);
    }
    if (trimmed.length > 60) {
      throw new StoreError('Category name must be 60 characters or fewer', 400);
    }

    const duplicate = this.db.categories.some(
      (c) => c.user_id === userId && c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      throw new StoreError('Category already exists', 409);
    }

    const userCats = this.listCategories(userId);
    const maxPos = userCats.reduce((max, c) => Math.max(max, c.position), -1);
    const created: Category = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: trimmed,
      position: maxPos + 1,
      created_at: new Date().toISOString(),
    };
    this.db.categories.push(created);
    this.save();
    return created;
  }

  public renameCategory(userId: string, categoryId: string, name: string): Category {
    const cat = this.db.categories.find((c) => c.id === categoryId && c.user_id === userId);
    if (!cat) {
      throw new StoreError('Category not found', 404);
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new StoreError('Category name cannot be empty', 400);
    }
    if (trimmed.length > 60) {
      throw new StoreError('Category name must be 60 characters or fewer', 400);
    }
    const duplicate = this.db.categories.some(
      (c) =>
        c.user_id === userId &&
        c.id !== categoryId &&
        c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      throw new StoreError('Category name already exists', 409);
    }

    cat.name = trimmed;
    this.save();
    return cat;
  }

  public reorderCategories(userId: string, orderedIds: string[]): Category[] {
    const userCats = this.listCategories(userId);
    const ownedMap = new Map(userCats.map((c) => [c.id, c]));
    let pos = 0;

    for (const id of orderedIds) {
      const cat = ownedMap.get(id);
      if (cat) {
        cat.position = pos++;
        ownedMap.delete(id);
      }
    }
    for (const leftover of ownedMap.values()) {
      leftover.position = pos++;
    }
    this.save();
    return this.listCategories(userId);
  }

  public deleteCategory(userId: string, categoryId: string): void {
    const idx = this.db.categories.findIndex((c) => c.id === categoryId && c.user_id === userId);
    if (idx === -1) {
      throw new StoreError('Category not found', 404);
    }
    this.db.categories.splice(idx, 1);
    // Items go to Inbox (on delete set null)
    for (const item of this.db.items) {
      if (item.user_id === userId && item.category_id === categoryId) {
        item.category_id = null;
      }
    }
    this.save();
  }

  private hydrateItem(record: StoredItemRecord): VaultItem {
    const tagIds = new Set(
      this.db.item_tags.filter((it) => it.item_id === record.id).map((it) => it.tag_id),
    );
    const tags = this.db.tags
      .filter((t) => t.user_id === record.user_id && tagIds.has(t.id))
      .map((t) => t.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      ...record,
      tags,
    };
  }

  private setItemTags(userId: string, itemId: string, tagNames: string[]): void {
    const cleanNames = Array.from(
      new Set(
        tagNames
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= 40),
      ),
    );

    // Clear existing links for this item
    this.db.item_tags = this.db.item_tags.filter((it) => it.item_id !== itemId);

    for (const tagName of cleanNames) {
      let tag = this.db.tags.find(
        (t) => t.user_id === userId && t.name.toLowerCase() === tagName.toLowerCase(),
      );
      if (!tag) {
        tag = {
          id: crypto.randomUUID(),
          user_id: userId,
          name: tagName,
        };
        this.db.tags.push(tag);
      }
      this.db.item_tags.push({ item_id: itemId, tag_id: tag.id });
    }
  }

  public listItems(
    userId: string,
    filters?: {
      categoryId?: string;
      inbox?: boolean;
      type?: ItemType;
      status?: ItemStatus;
      tag?: string;
      q?: string;
      limit?: number;
      offset?: number;
    },
  ): { items: VaultItem[]; total: number } {
    let rows = this.db.items
      .filter((i) => i.user_id === userId)
      .map((i) => this.hydrateItem(i))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (filters?.inbox) {
      rows = rows.filter((i) => i.category_id === null);
    } else if (filters?.categoryId) {
      rows = rows.filter((i) => i.category_id === filters.categoryId);
    }

    if (filters?.type) {
      rows = rows.filter((i) => i.type === filters.type);
    }
    if (filters?.status) {
      rows = rows.filter((i) => i.status === filters.status);
    }
    if (filters?.tag) {
      const targetTag = filters.tag.toLowerCase();
      rows = rows.filter((i) => i.tags.some((t) => t.toLowerCase() === targetTag));
    }
    if (filters?.q) {
      rows = rows.filter((i) => matchesSearchQuery(i, filters.q!));
    }

    const total = rows.length;
    const offset = Math.max(0, filters?.offset ?? 0);
    const limit = filters?.limit ? Math.max(1, filters.limit) : total || 50;
    return {
      items: rows.slice(offset, offset + limit),
      total,
    };
  }

  public findItemByUrl(userId: string, rawUrl: string): VaultItem | null {
    const normalized = normalizeUrlInput(rawUrl);
    const found = this.db.items.find(
      (i) => i.user_id === userId && i.url.toLowerCase() === normalized.toLowerCase(),
    );
    return found ? this.hydrateItem(found) : null;
  }

  public getItem(userId: string, itemId: string): VaultItem {
    const found = this.db.items.find((i) => i.id === itemId && i.user_id === userId);
    if (!found) {
      throw new StoreError('Item not found', 404);
    }
    return this.hydrateItem(found);
  }

  public createItem(userId: string, input: CreateItemInput): VaultItem {
    const normalizedUrl = normalizeUrlInput(input.url);
    if (!isValidHttpUrl(normalizedUrl)) {
      throw new StoreError('Valid http/https URL is required', 400);
    }

    const existing = this.findItemByUrl(userId, normalizedUrl);
    if (existing) {
      throw new StoreError('Already saved', 409, 'DUPLICATE_URL', existing);
    }

    if (input.category_id) {
      const ownsCat = this.db.categories.some(
        (c) => c.id === input.category_id && c.user_id === userId,
      );
      if (!ownsCat) {
        throw new StoreError('Invalid category', 400);
      }
    }

    const title = (input.title || '').trim();
    if (!title) {
      throw new StoreError('Title is required', 400);
    }

    const source = input.source ?? detectSourceFromUrl(normalizedUrl);
    const type = input.type ?? detectTypeFromUrl(normalizedUrl, source);

    const record: StoredItemRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      url: normalizedUrl,
      title,
      description: (input.description || '').trim(),
      thumbnail_url:
        input.thumbnail_url && isValidHttpUrl(input.thumbnail_url) ? input.thumbnail_url : '',
      source,
      type,
      note: (input.note || '').trim(),
      category_id: input.category_id ?? null,
      status: input.status === 'done' ? 'done' : 'todo',
      created_at: new Date().toISOString(),
    };

    this.db.items.push(record);
    if (Array.isArray(input.tags) && input.tags.length > 0) {
      this.setItemTags(userId, record.id, input.tags);
    }
    this.save();
    return this.hydrateItem(record);
  }

  public updateItem(userId: string, itemId: string, patch: UpdateItemInput): VaultItem {
    const record = this.db.items.find((i) => i.id === itemId && i.user_id === userId);
    if (!record) {
      throw new StoreError('Item not found', 404);
    }

    if (patch.category_id !== undefined && patch.category_id !== null) {
      const ownsCat = this.db.categories.some(
        (c) => c.id === patch.category_id && c.user_id === userId,
      );
      if (!ownsCat) {
        throw new StoreError('Invalid category', 400);
      }
    }

    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (!trimmed) {
        throw new StoreError('Title cannot be empty', 400);
      }
      record.title = trimmed;
    }
    if (patch.description !== undefined) {
      record.description = patch.description.trim();
    }
    if (patch.thumbnail_url !== undefined) {
      record.thumbnail_url =
        patch.thumbnail_url && isValidHttpUrl(patch.thumbnail_url) ? patch.thumbnail_url : '';
    }
    if (patch.source !== undefined) {
      record.source = patch.source;
    }
    if (patch.type !== undefined) {
      record.type = patch.type;
    }
    if (patch.note !== undefined) {
      record.note = patch.note;
    }
    if (patch.category_id !== undefined) {
      record.category_id = patch.category_id;
    }
    if (patch.status !== undefined) {
      record.status = patch.status === 'done' ? 'done' : 'todo';
    }
    if (patch.tags !== undefined) {
      this.setItemTags(userId, record.id, patch.tags);
    }

    this.save();
    return this.hydrateItem(record);
  }

  public deleteItem(userId: string, itemId: string): void {
    const idx = this.db.items.findIndex((i) => i.id === itemId && i.user_id === userId);
    if (idx === -1) {
      throw new StoreError('Item not found', 404);
    }
    this.db.items.splice(idx, 1);
    this.db.item_tags = this.db.item_tags.filter((it) => it.item_id !== itemId);
    this.save();
  }

  public listTags(userId: string): Tag[] {
    const usedTagIds = new Set(this.db.item_tags.map((it) => it.tag_id));
    return this.db.tags
      .filter((t) => t.user_id === userId && usedTagIds.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
