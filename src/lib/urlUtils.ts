import type { ItemType, SourceType } from './types';

export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed) || /^[a-z0-9-]+(\.[a-z]{2,})+(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (!parsed.hostname || parsed.hostname.length > 253) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function looksLikeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    return isValidHttpUrl(trimmed);
  }
  if (/^[a-z0-9-]+(\.[a-z]{2,})+([/?#].*)?$/i.test(trimmed)) {
    return isValidHttpUrl(`https://${trimmed}`);
  }
  return false;
}

export function isSafeExternalHref(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return isValidHttpUrl(raw.trim());
}

function isPrivateIpv4Octets(o0: number, o1: number, o2: number, o3: number): boolean {
  if ([o0, o1, o2, o3].some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  if (o0 === 0) return true; // 0.0.0.0/8
  if (o0 === 10) return true; // 10.0.0.0/8
  if (o0 === 100 && o1 >= 64 && o1 <= 127) return true; // CGNAT 100.64.0.0/10
  if (o0 === 127) return true; // Loopback 127.0.0.0/8
  if (o0 === 169 && o1 === 254) return true; // Link-local / cloud metadata 169.254.0.0/16
  if (o0 === 172 && o1 >= 16 && o1 <= 31) return true; // 172.16.0.0/12
  if (o0 === 192 && o1 === 0 && (o2 === 0 || o2 === 2)) return true; // IETF / TEST-NET-1
  if (o0 === 192 && o1 === 168) return true; // 192.168.0.0/16
  if (o0 === 198 && (o1 === 18 || o1 === 19)) return true; // Benchmarking 198.18.0.0/15
  if (o0 === 198 && o1 === 51 && o2 === 100) return true; // TEST-NET-2
  if (o0 === 203 && o1 === 0 && o2 === 113) return true; // TEST-NET-3
  if (o0 >= 224) return true; // Multicast & reserved >= 224.0.0.0
  return false;
}

export function isBlockedIpOrHost(hostnameOrIp: string): boolean {
  if (!hostnameOrIp) return true;
  let host = hostnameOrIp.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  host = host.replace(/\.+$/, '');
  if (!host) return true;

  // Block explicit local/internal hostnames
  if (
    host === 'localhost' ||
    host === 'ip6-localhost' ||
    host === 'ip6-loopback' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain') ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    return true;
  }

  // Block single-integer / hex / octal IP notations (e.g. 2130706433, 0x7f000001)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
    return true;
  }

  // Dotted IPv4 check (including leading-zero octal forms like 0177.0.0.1)
  const ipv4Parts = host.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^(0x[0-9a-f]+|0[0-7]*|\d+)$/i.test(p))) {
    const octets = ipv4Parts.map((p) => {
      if (p.toLowerCase().startsWith('0x')) return Number.parseInt(p, 16);
      if (p.length > 1 && p.startsWith('0')) return Number.parseInt(p, 8);
      return Number.parseInt(p, 10);
    });
    return isPrivateIpv4Octets(octets[0], octets[1], octets[2], octets[3]);
  }

  // IPv6 check
  if (host.includes(':')) {
    const zoneStripped = host.split('%')[0];
    if (zoneStripped === '::' || zoneStripped === '::1') return true;
    // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
    if (zoneStripped.startsWith('::ffff:')) {
      const rest = zoneStripped.slice('::ffff:'.length);
      if (rest.includes('.')) {
        return isBlockedIpOrHost(rest);
      }
      const hexGroups = rest.split(':');
      if (hexGroups.length === 2) {
        const hi = Number.parseInt(hexGroups[0], 16);
        const lo = Number.parseInt(hexGroups[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          return isPrivateIpv4Octets((hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff);
        }
      }
      return true;
    }
    const firstSegment = zoneStripped.split(':')[0];
    const firstWord = Number.parseInt(firstSegment || '0', 16);
    if (!Number.isNaN(firstWord)) {
      // fc00::/7 (Unique Local Address)
      if ((firstWord & 0xfe00) === 0xfc00) return true;
      // fe80::/10 (Link-local)
      if ((firstWord & 0xffc0) === 0xfe80) return true;
      // ff00::/8 (Multicast)
      if ((firstWord & 0xff00) === 0xff00) return true;
    }
    return false;
  }

  // Must contain a dot for public DNS hostnames
  if (!host.includes('.')) {
    return true;
  }

  return false;
}

export function detectSourceFromUrl(urlStr: string): SourceType {
  try {
    const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube.com')
    ) {
      return 'youtube';
    }
    if (host === 'instagram.com' || host === 'instagr.am' || host.endsWith('.instagram.com')) {
      return 'instagram';
    }
    if (
      host === 'facebook.com' ||
      host === 'm.facebook.com' ||
      host === 'fb.watch' ||
      host === 'fb.com' ||
      host.endsWith('.facebook.com')
    ) {
      return 'facebook';
    }
    if (
      host === 'x.com' ||
      host === 'twitter.com' ||
      host === 'mobile.twitter.com' ||
      host === 't.co' ||
      host.endsWith('.x.com') ||
      host.endsWith('.twitter.com')
    ) {
      return 'x';
    }
    if (
      host === 'tiktok.com' ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com' ||
      host.endsWith('.tiktok.com')
    ) {
      return 'tiktok';
    }
    return 'web';
  } catch {
    return 'web';
  }
}

export function detectTypeFromUrl(urlStr: string, source?: SourceType): ItemType {
  const resolvedSource = source ?? detectSourceFromUrl(urlStr);
  let pathname = '';
  try {
    pathname = new URL(urlStr).pathname.toLowerCase();
  } catch {
    pathname = urlStr.toLowerCase();
  }

  if (resolvedSource === 'youtube' || resolvedSource === 'tiktok') {
    return 'video';
  }
  if (resolvedSource === 'instagram') {
    if (pathname.includes('/reel') || pathname.includes('/tv/')) {
      return 'video';
    }
    return 'post';
  }
  if (resolvedSource === 'facebook') {
    if (pathname.includes('/reel') || pathname.includes('/watch') || pathname.includes('/videos')) {
      return 'video';
    }
    return 'post';
  }
  if (resolvedSource === 'x') {
    return 'post';
  }
  if (pathname.endsWith('.pdf') || pathname.endsWith('.epub') || pathname.includes('/epub')) {
    return 'ebook';
  }
  return 'article';
}

export function extractYouTubeVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id || null;
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function getHostnameLabel(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./i, '');
  } catch {
    return urlStr;
  }
}
