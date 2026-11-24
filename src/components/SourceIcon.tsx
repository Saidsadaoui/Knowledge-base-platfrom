import React, { useState } from 'react';
import { Globe, Play, Share2, Video, FileText, BookOpen } from 'lucide-react';
import type { ItemType, SourceType } from '../lib/types';

export function SourceIcon({
  source,
  size = 14,
  className = '',
}: {
  source: SourceType;
  size?: number;
  className?: string;
}) {
  const stroke = 1.75;
  switch (source) {
    case 'youtube':
      return <Play size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    case 'instagram':
      return <Share2 size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    case 'facebook':
      return <Share2 size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    case 'x':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 4l16 16" />
          <path d="M20 4L4 20" />
        </svg>
      );
    case 'tiktok':
      return <Video size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    default:
      return <Globe size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
  }
}

export function ItemTypeIcon({
  type,
  size = 16,
  className = '',
}: {
  type: ItemType;
  size?: number;
  className?: string;
}) {
  const stroke = 1.75;
  switch (type) {
    case 'video':
      return <Play size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    case 'post':
      return <Share2 size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    case 'ebook':
      return <BookOpen size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
    default:
      return <FileText size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
  }
}

export function ItemThumbnail({
  src,
  alt,
  source,
  type,
  className = '',
  iconSize = 16,
}: {
  src: string;
  alt: string;
  source: SourceType;
  type: ItemType;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0 ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[var(--text-muted)] flex items-center justify-center">
          {source !== 'web' ? (
            <SourceIcon source={source} size={iconSize} />
          ) : (
            <ItemTypeIcon type={type} size={iconSize} />
          )}
        </span>
      )}
    </div>
  );
}
