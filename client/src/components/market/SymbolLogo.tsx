import { useState } from 'react';
import { cn } from '@/utils/cn';

interface SymbolLogoProps {
  symbol: string;
  name?: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-xs',
  lg: 'size-14 text-base',
} as const;

function initials(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9 ]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export function SymbolLogo({ symbol, name, logoUrl, size = 'md', className }: SymbolLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-canvas font-semibold text-content-muted',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={logoUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name ?? symbol)
      )}
    </span>
  );
}
