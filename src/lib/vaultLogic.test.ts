import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSourceFromUrl,
  detectTypeFromUrl,
  isBlockedIpOrHost,
  isSafeExternalHref,
  isValidHttpUrl,
  looksLikeUrl,
  normalizeUrlInput,
} from './urlUtils';
import {
  decodeHtmlEntities,
  parseHtmlMetadata,
  parseTwitterOEmbed,
  parseYouTubeOEmbed,
} from './metadataParser';
import {
  formatRelativeDate,
  highlightMatchSegments,
  itemsToCsv,
  matchesSearchQuery,
} from './searchAndExport';
import type { Category, VaultItem } from './types';

test('URL validation and normalization', () => {
  assert.equal(isValidHttpUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl('data:text/html,hi'), false);
  assert.equal(normalizeUrlInput('  youtube.com/watch?v=123  '), 'https://youtube.com/watch?v=123');
  assert.equal(looksLikeUrl('https://example.com/article'), true);
  assert.equal(looksLikeUrl('AI skills for agentic agents'), false);
  assert.equal(isSafeExternalHref('javascript:void(0)'), false);
  assert.equal(isSafeExternalHref('https://example.com/a.pdf'), true);
});

test('SSRF private IP and local host blocking', () => {
  assert.equal(isBlockedIpOrHost('localhost'), true);
  assert.equal(isBlockedIpOrHost('127.0.0.1'), true);
  assert.equal(isBlockedIpOrHost('10.24.1.5'), true);
  assert.equal(isBlockedIpOrHost('172.16.0.1'), true);
  assert.equal(isBlockedIpOrHost('172.31.255.254'), true);
  assert.equal(isBlockedIpOrHost('192.168.1.1'), true);
  assert.equal(isBlockedIpOrHost('169.254.169.254'), true);
  assert.equal(isBlockedIpOrHost('::1'), true);
  assert.equal(isBlockedIpOrHost('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIpOrHost('fc00::1'), true);
  assert.equal(isBlockedIpOrHost('fe80::1'), true);
  assert.equal(isBlockedIpOrHost('0x7f000001'), true);
  assert.equal(isBlockedIpOrHost('metadata.google.internal'), true);
  assert.equal(isBlockedIpOrHost('172.32.0.1'), false);
  assert.equal(isBlockedIpOrHost('2a03:2880:f289:1e0:face:b00c:0:4420'), false);
  assert.equal(isBlockedIpOrHost('www.youtube.com'), false);
  assert.equal(isBlockedIpOrHost('example.com'), false);
});

test('Source and type detection across platforms', () => {
  assert.equal(detectSourceFromUrl('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectTypeFromUrl('https://youtu.be/dQw4w9WgXcQ'), 'video');

  assert.equal(detectSourceFromUrl('https://www.instagram.com/reel/C12345/'), 'instagram');
  assert.equal(detectTypeFromUrl('https://www.instagram.com/reel/C12345/'), 'video');
  assert.equal(detectTypeFromUrl('https://www.instagram.com/p/C12345/'), 'post');

  assert.equal(detectSourceFromUrl('https://x.com/user/status/123'), 'x');
  assert.equal(detectTypeFromUrl('https://x.com/user/status/123'), 'post');

  assert.equal(detectSourceFromUrl('https://www.facebook.com/watch/?v=123'), 'facebook');
  assert.equal(detectTypeFromUrl('https://www.facebook.com/watch/?v=123'), 'video');

  assert.equal(detectSourceFromUrl('https://www.tiktok.com/@a/video/123'), 'tiktok');
  assert.equal(detectTypeFromUrl('https://www.tiktok.com/@a/video/123'), 'video');

  assert.equal(detectSourceFromUrl('https://arxiv.org/pdf/2401.00001.pdf'), 'web');
  assert.equal(detectTypeFromUrl('https://arxiv.org/pdf/2401.00001.pdf'), 'ebook');
  assert.equal(detectTypeFromUrl('https://example.com/books/epub/quran'), 'ebook');
  assert.equal(detectTypeFromUrl('https://anthropic.com/research/building-effective-agents'), 'article');
});

test('HTML and oEmbed metadata parsing', () => {
  const html = `
    <html>
      <head>
        <title>Fallback &amp; Title</title>
        <meta property="og:title" content="Building Effective Agents &mdash; Anthropic" />
        <meta name="description" content="Practical patterns for agentic systems." />
        <meta property="og:image" content="/images/cover.png" />
      </head>
    </html>
  `;
  const parsed = parseHtmlMetadata(html, 'https://anthropic.com/research/agents');
  assert.equal(parsed.title, 'Building Effective Agents — Anthropic');
  assert.equal(parsed.description, 'Practical patterns for agentic systems.');
  assert.equal(parsed.thumbnail_url, 'https://anthropic.com/images/cover.png');
  assert.equal(parsed.source, 'web');
  assert.equal(parsed.type, 'article');
  assert.equal(parsed.fetchFailed, false);

  // Blocks unsafe javascript: image URI
  const unsafeHtml = `<meta property="og:image" content="javascript:alert(1)" /><title>Safe &lt;Title&gt;</title>`;
  const safeParsed = parseHtmlMetadata(unsafeHtml, 'https://example.com/post');
  assert.equal(safeParsed.thumbnail_url, '');
  assert.equal(safeParsed.title, 'Safe <Title>');

  assert.equal(decodeHtmlEntities('A &amp; B &#39;C&#39;'), "A & B 'C'");

  const yt = parseYouTubeOEmbed(
    { title: 'Agentic Workflows', thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
    'https://www.youtube.com/watch?v=abc',
  );
  assert.equal(yt.source, 'youtube');
  assert.equal(yt.type, 'video');
  assert.equal(yt.title, 'Agentic Workflows');

  const tw = parseTwitterOEmbed(
    { author_name: 'Karpathy', html: '<blockquote><p>LLM OS notes &amp; links</p></blockquote>' },
    'https://x.com/karpathy/status/1',
  );
  assert.equal(tw.source, 'x');
  assert.equal(tw.type, 'post');
  assert.equal(tw.title, 'Karpathy: LLM OS notes & links');
});

test('Multilingual search (English, French, Arabic), highlighting, dates, and CSV export', () => {
  const item: VaultItem = {
    id: 'i1',
    user_id: 'u1',
    url: 'https://example.com/hadith',
    title: 'تعلّم مهارات الوكلاء الذكيين',
    description: 'Guide pratique pour les agents',
    thumbnail_url: '',
    source: 'web',
    type: 'article',
    note: 'AI skills for agentic agents — مهم جدا',
    category_id: 'c1',
    status: 'todo',
    created_at: '2026-11-24T01:00:00.000Z',
    tags: ['agents', 'حديث'],
  };

  assert.equal(matchesSearchQuery(item, 'agents'), true);
  assert.equal(matchesSearchQuery(item, 'مهارات'), true);
  assert.equal(matchesSearchQuery(item, 'pratique'), true);
  assert.equal(matchesSearchQuery(item, 'حديث'), true);
  assert.equal(matchesSearchQuery(item, 'nonexistent'), false);

  const segments = highlightMatchSegments('AI skills for agentic agents', 'agents');
  assert.deepEqual(segments, [
    { text: 'AI skills for agentic ', match: false },
    { text: 'agents', match: true },
  ]);

  const now = new Date('2026-11-24T02:00:00.000Z');
  assert.equal(formatRelativeDate('2026-11-24T01:55:00.000Z', now), '5m ago');
  assert.equal(formatRelativeDate('2026-11-24T01:00:00.000Z', now), '1h ago');

  const cats: Category[] = [{ id: 'c1', user_id: 'u1', name: 'AI', position: 0, created_at: '' }];
  const csv = itemsToCsv([{ ...item, note: '=SUM(A1), "quoted"' }], cats);
  assert.ok(csv.includes('id,url,title,source,type,status,category,note,tags'));
  assert.ok(csv.includes('"\'=SUM(A1), ""quoted"""'));
});
