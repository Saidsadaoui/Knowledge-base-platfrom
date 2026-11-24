export type SourceType = 'youtube' | 'instagram' | 'facebook' | 'x' | 'tiktok' | 'web';

export type ItemType = 'video' | 'post' | 'article' | 'ebook';

export type ItemStatus = 'todo' | 'done';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface VaultItem {
  id: string;
  user_id: string;
  url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  source: SourceType;
  type: ItemType;
  note: string;
  category_id: string | null;
  status: ItemStatus;
  created_at: string;
  tags: string[];
}

export interface MetadataResult {
  url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  source: SourceType;
  type: ItemType;
  fetchFailed: boolean;
}

export interface CreateItemInput {
  url: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  source?: SourceType;
  type: ItemType;
  note?: string;
  category_id: string | null;
  status?: ItemStatus;
  tags?: string[];
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  source?: SourceType;
  type?: ItemType;
  note?: string;
  category_id?: string | null;
  status?: ItemStatus;
  tags?: string[];
}
