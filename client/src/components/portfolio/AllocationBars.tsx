import { Card, Skeleton } from '@/components/ui';
import type { AllocationSlice } from '@/types';
import { changeTone, formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

interface AllocationBarsProps {
  slices: AllocationSlice[] | undefined;
  currency: string;
  title: string;
  loading?: boolean;
}

export function AllocationBars({ slices, currency, title, loading }: AllocationBarsProps) {
  const data = slices ?? [];

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} rounded="sm" className="h-8" />
          ))}
        </div>
      ) : data.length ? (
        <ul className="space-y-3">
          {data.map((slice) => {
            const tone = changeTone(slice.pnl);
            return (
              <li key={slice.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{slice.label}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span data-numeric className="text-content-muted">
                      {formatCurrency(slice.value, currency, 0)}
                    </span>
                    <span data-numeric className="w-12 text-right font-medium">
                      {slice.weight.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-content/[0.06]">
                  <div
                    style={{ width: `${Math.max(2, slice.weight)}%` }}
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500 ease-swift',
                      tone === 'down' ? 'bg-bear' : 'bg-brand-600',
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-content-subtle">Nothing to show yet.</p>
      )}
    </Card>
  );
}
