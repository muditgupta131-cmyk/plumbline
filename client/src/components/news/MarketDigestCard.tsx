import { Newspaper } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import type { MarketDigest } from '@/types';
import { cn } from '@/utils/cn';
import { SentimentChip } from './SentimentChip';

interface MarketDigestCardProps {
  digest: MarketDigest | undefined;
  loading?: boolean;
}

export function MarketDigestCard({ digest, loading }: MarketDigestCardProps) {
  if (loading) {
    return (
      <Card className="space-y-3 p-5 sm:p-6">
        <Skeleton rounded="sm" className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!digest) return null;

  const total = digest.articleCount || 1;
  const share = (value: number) => `${(value / total) * 100}%`;

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Newspaper className="size-4 text-content-subtle" aria-hidden />
          Today in the {digest.market === 'IN' ? 'Indian' : 'US'} market
        </h2>
        <SentimentChip sentiment={digest.tone} keywordBased={digest.engine === 'keyword'} />
      </div>

      <p className="text-sm leading-relaxed text-content-muted">{digest.summary}</p>

      <div className="space-y-1.5">
        <div className="flex h-2 overflow-hidden rounded-full bg-content/[0.06]">
          <div style={{ width: share(digest.breakdown.positive) }} className="bg-bull" />
          <div style={{ width: share(digest.breakdown.neutral) }} className="bg-content/20" />
          <div style={{ width: share(digest.breakdown.negative) }} className="bg-bear" />
        </div>
        <p data-numeric className="text-xs text-content-subtle">
          {digest.breakdown.positive} positive · {digest.breakdown.neutral} neutral · {digest.breakdown.negative}{' '}
          negative across {digest.articleCount} headlines
        </p>
      </div>

      {digest.drivers.length ? (
        <div className="border-t border-hairline pt-3">
          <p className="mb-2 text-xs font-medium text-content-subtle">Headlines moving the tone</p>
          <ul className="space-y-1.5">
            {digest.drivers.map((driver) => (
              <li key={driver} className={cn('text-sm text-content-muted')}>
                {driver}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
