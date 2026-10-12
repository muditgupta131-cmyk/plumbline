import type { CSSProperties } from 'react';
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'full';
  style?: CSSProperties;
}

export function Skeleton({ className, rounded = 'md', style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'relative overflow-hidden bg-content/[0.07]',
        rounded === 'sm' && 'rounded-md',
        rounded === 'md' && 'rounded-xl',
        rounded === 'full' && 'rounded-full',
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-content/[0.09] to-transparent" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} rounded="sm" className={cn('h-3.5', index === lines - 1 && 'w-2/3')} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-4 rounded-card border border-hairline bg-surface p-6">
      <div className="flex items-center gap-3">
        <Skeleton rounded="full" className="size-10" />
        <div className="flex-1 space-y-2">
          <Skeleton rounded="sm" className="h-3.5 w-24" />
          <Skeleton rounded="sm" className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <SkeletonText lines={2} />
    </div>
  );
}
