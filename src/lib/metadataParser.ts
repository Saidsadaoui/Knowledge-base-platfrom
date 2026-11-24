import { detectSourceFromUrl, detectTypeFromUrl, isSafeExternalHref } from './urlUtils';
import type { MetadataResult } from './types';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (full, name) => NAMED_ENTITIES[name.toLowerCase()] ?? full)
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeImageUrl(candidate: string | null | undefined, baseUrl: string): string {
  if (!candidate) return '';
  const trimmed = decodeHtmlEntities(candidate).trim();
  if (!trimmed) return '';
  try {
    const resolved = new URL(trimmed, baseUrl).toString();
    return isSafeExternalHref(resolved) ? resolved : '';
  } catch {
    return '';
  }
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const metaTagRegex = /<meta\b[^>]*>/gi;
  const attrRegex = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  let match: RegExpExecArray | null;
  while ((match = metaTagRegex.exec(html)) !== null) {
    const tag = match[0];
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    attrRegex.lastIndex = 0;
    while ((attrMatch = attrRegex.exec(tag)) !== null) {
      const key = attrMatch[1].toLowerCase();
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      attrs[key] = val;
    }
    if ((attrs[attrName] || '').toLowerCase() === attrValue.toLowerCase() && attrs.content) {
      return decodeHtmlEntities(attrs.content);
    }
  }
  return '';
}

function extractTitleTag(html: string): string {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeHtmlEntities(m[1]) : '';
}

export function parseHtmlMetadata(html: string, pageUrl: string): MetadataResult {
  const source = detectSourceFromUrl(pageUrl);
  const type = detectTypeFromUrl(pageUrl, source);

  const ogTitle =
    extractMetaContent(html, 'property', 'og:title') ||
    extractMetaContent(html, 'name', 'twitter:title') ||
    extractMetaContent(html, 'name', 'title');
  const title = ogTitle || extractTitleTag(html);

  const description =
    extractMetaContent(html, 'property', 'og:description') ||
    extractMetaContent(html, 'name', 'twitter:description') ||
    extractMetaContent(html, 'name', 'description');

  const rawImage =
    extractMetaContent(html, 'property', 'og:image') ||
    extractMetaContent(html, 'property', 'og:image:secure_url') ||
    extractMetaContent(html, 'name', 'twitter:image') ||
    extractMetaContent(html, 'name', 'twitter:image:src');

  const thumbnail_url = sanitizeImageUrl(rawImage, pageUrl);

  return {
    url: pageUrl,
    title,
    description,
    thumbnail_url,
    source,
    type,
    fetchFailed: !title && !description && !thumbnail_url,
  };
}

export function parseYouTubeOEmbed(
  data: { title?: unknown; thumbnail_url?: unknown; author_name?: unknown },
  pageUrl: string,
): MetadataResult {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const author = typeof data.author_name === 'string' ? data.author_name.trim() : '';
  const thumbnail_url =
    typeof data.thumbnail_url === 'string' ? sanitizeImageUrl(data.thumbnail_url, pageUrl) : '';

  return {
    url: pageUrl,
    title,
    description: author ? author : '',
    thumbnail_url,
    source: 'youtube',
    type: 'video',
    fetchFailed: !title,
  };
}

export function parseTwitterOEmbed(
  data: { author_name?: unknown; html?: unknown },
  pageUrl: string,
): MetadataResult {
  const author = typeof data.author_name === 'string' ? data.author_name.trim() : '';
  let postText = '';
  if (typeof data.html === 'string') {
    const pMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(data.html);
    if (pMatch) {
      const stripped = pMatch[1].replace(/<[^>]+>/g, ' ');
      postText = decodeHtmlEntities(stripped);
    }
  }

  const title = author && postText ? `${author}: ${postText}` : postText || author;
  return {
    url: pageUrl,
    title: title.slice(0, 220),
    description: postText,
    thumbnail_url: '',
    source: 'x',
    type: 'post',
    fetchFailed: !title,
  };
}
