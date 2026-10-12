import { Card, Delta, Skeleton } from '@/components/ui';
import type { IndexQuote } from '@/types';
import { formatNumber } from '@/utils/format';

export function IndexCardSkeleton() {
  return (
    <Card className="space-y-3 p-5">
      <Skeleton rounded="sm" className="h-3.5 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton rounded="sm" className="h-3 w-40" />
    </Card>
  );
}

export function IndexCard({ index }: { index: IndexQuote }) {
  const stats = [
    { label: 'Open', value: index.open },
    { label: 'High', value: index.high },
    { label: 'Low', value: index.low },
  ];

  return (
    <Card interactive className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{index.name}</p>
          <p className="text-eyebrow uppercase text-content-subtle">{index.market === 'IN' ? 'India' : 'United States'}</p>
        </div>
        <Delta value={index.changePercent} />
      </div>

      <p data-numeric className="mt-3 text-2xl font-semibold">
        {formatNumber(index.value)}
      </p>

      <dl className="mt-4 flex gap-4 border-t border-hairline pt-3 text-xs">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-content-subtle">{stat.label}</dt>
            <dd data-numeric className="truncate font-medium">
              {formatNumber(stat.value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
