import dns from 'node:dns/promises';
import {
  parseHtmlMetadata,
  parseTwitterOEmbed,
  parseYouTubeOEmbed,
} from '../src/lib/metadataParser';
import {
  detectSourceFromUrl,
  detectTypeFromUrl,
  isBlockedIpOrHost,
  isValidHttpUrl,
  normalizeUrlInput,
} from '../src/lib/urlUtils';
import type { MetadataResult } from '../src/lib/types';

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 1024 * 1024; // 1MB cap
const MAX_REDIRECTS = 3;

export class SsrfOrValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SsrfOrValidationError';
    this.status = status;
  }
}

async function assertPublicDestination(urlStr: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SsrfOrValidationError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfOrValidationError('Only http and https URLs are allowed');
  }

  if (isBlockedIpOrHost(parsed.hostname)) {
    throw new SsrfOrValidationError('Blocked host or private network address');
  }

  try {
    const records = await dns.lookup(parsed.hostname, { all: true });
    if (!records || records.length === 0) {
      throw new SsrfOrValidationError('Host could not be resolved');
    }
    for (const rec of records) {
      if (isBlockedIpOrHost(rec.address)) {
        throw new SsrfOrValidationError('Resolved to a blocked private or local IP');
      }
    }
  } catch (err) {
    if (err instanceof SsrfOrValidationError) throw err;
    // DNS lookup failed (e.g. offline environment or non-existent domain)
    throw new Error('DNS_LOOKUP_FAILED');
  }

  return parsed;
}

async function safeFetchWithRedirects(
  initialUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicDestination(currentUrl);
    const res = await fetch(currentUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { response: res, finalUrl: currentUrl };
      }
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isValidHttpUrl(nextUrl)) {
        throw new SsrfOrValidationError('Blocked redirect target');
      }
      currentUrl = nextUrl;
      continue;
    }

    return { response: res, finalUrl: currentUrl };
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return (await response.text()).slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const remaining = maxBytes - total;
      if (remaining <= 0) {
        await reader.cancel().catch(() => {});
        break;
      }
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

function isGenericSocialWallTitle(source: string, title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (source === 'instagram' && (t === 'instagram' || t.includes('login') || t.includes('sign in'))) {
    return true;
  }
  if (source === 'facebook' && (t === 'facebook' || t.includes('log into facebook') || t.includes('log in or sign up'))) {
    return true;
  }
  if (source === 'tiktok' && (t === 'tiktok' || t === 'tiktok - make your day')) {
    return true;
  }
  return false;
}

export async function fetchUrlMetadata(rawUrl: string): Promise<MetadataResult> {
  const normalized = normalizeUrlInput(rawUrl);
  if (!isValidHttpUrl(normalized)) {
    throw new SsrfOrValidationError('Please enter a valid http or https URL');
  }

  const parsedInput = new URL(normalized);
  if (isBlockedIpOrHost(parsedInput.hostname)) {
    throw new SsrfOrValidationError('Private or local network URLs are not allowed');
  }

  const source = detectSourceFromUrl(normalized);
  const type = detectTypeFromUrl(normalized, source);

  const fallbackResult: MetadataResult = {
    url: normalized,
    title: '',
    description: '',
    thumbnail_url: '',
    source,
    type,
    fetchFailed: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const commonHeaders = {
    'User-Agent':
      'Mozilla/5.0 (compatible; VaultBot/1.0; +https://vault.local)',
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,fr;q=0.8',
  };

  try {
    // 1. YouTube oEmbed
    if (source === 'youtube') {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalized)}&format=json`;
        const { response } = await safeFetchWithRedirects(oembedUrl, commonHeaders, controller.signal);
        if (response.ok) {
          const json = (await response.json()) as Record<string, unknown>;
          const parsed = parseYouTubeOEmbed(json, normalized);
          if (!parsed.fetchFailed) {
            return parsed;
          }
        }
      } catch (err) {
        if (err instanceof SsrfOrValidationError) throw err;
        // Fall through to HTML or graceful fallback
      }
    }

    // 2. X / Twitter oEmbed
    if (source === 'x') {
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalized)}&omit_script=true`;
        const { response } = await safeFetchWithRedirects(oembedUrl, commonHeaders, controller.signal);
        if (response.ok) {
          const json = (await response.json()) as Record<string, unknown>;
          const parsed = parseTwitterOEmbed(json, normalized);
          if (!parsed.fetchFailed) {
            return parsed;
          }
        }
      } catch (err) {
        if (err instanceof SsrfOrValidationError) throw err;
      }
    }

    // 3. Direct HTML / Open Graph fetch (handles web, fallback for YouTube/Instagram/Facebook/TikTok)
    const { response, finalUrl } = await safeFetchWithRedirects(
      normalized,
      commonHeaders,
      controller.signal,
    );

    if (!response.ok) {
      return fallbackResult;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || contentType.includes('application/epub+zip')) {
      const pathParts = new URL(finalUrl).pathname.split('/').filter(Boolean);
      const lastSeg = decodeURIComponent(pathParts[pathParts.length - 1] || 'Ebook');
      return {
        url: normalized,
        title: lastSeg.replace(/\.(pdf|epub)$/i, '').replace(/[-_]+/g, ' '),
        description: '',
        thumbnail_url: '',
        source,
        type: 'ebook',
        fetchFailed: false,
      };
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return fallbackResult;
    }

    const html = await readBodyCapped(response, MAX_HTML_BYTES);
    const parsed = parseHtmlMetadata(html, finalUrl);
    parsed.url = normalized;
    parsed.source = source;
    parsed.type = type;

    if (
      (source === 'instagram' || source === 'facebook' || source === 'tiktok') &&
      isGenericSocialWallTitle(source, parsed.title)
    ) {
      return fallbackResult;
    }

    return parsed;
  } catch (err) {
    if (err instanceof SsrfOrValidationError) {
      throw err;
    }
    return fallbackResult;
  } finally {
    clearTimeout(timeoutId);
  }
}
