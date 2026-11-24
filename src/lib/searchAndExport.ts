import type { Category, VaultItem } from './types';

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function matchesSearchQuery(item: VaultItem, query: string): boolean {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return true;

  const haystack = [
    item.title,
    item.note,
    item.description,
    item.url,
    ...item.tags,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export interface TextSegment {
  text: string;
  match: boolean;
}

export function highlightMatchSegments(text: string, query: string): TextSegment[] {
  if (!text) return [];
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return [{ text, match: false }];

  const escaped = tokens
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const lower = part.toLowerCase();
      const isMatch = tokens.some((t) => lower === t);
      return { text: part, match: isMatch };
    });
}

export function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function itemsToCsv(items: VaultItem[], categories: Category[]): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const headers = [
    'id',
    'url',
    'title',
    'source',
    'type',
    'status',
    'category',
    'note',
    'tags',
    'description',
    'thumbnail_url',
    'created_at',
  ];

  const rows = items.map((item) => {
    const categoryName = item.category_id ? categoryMap.get(item.category_id) ?? '' : 'Inbox';
    return [
      item.id,
      item.url,
      item.title || '',
      item.source,
      item.type,
      item.status,
      categoryName,
      item.note || '',
      item.tags.join('; '),
      item.description || '',
      item.thumbnail_url || '',
      item.created_at,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
