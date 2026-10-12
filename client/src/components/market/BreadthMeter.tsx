import { Card, Skeleton } from '@/components/ui';
import type { MarketBreadth } from '@/types';

interface BreadthMeterProps {
  breadth?: MarketBreadth;
  loading?: boolean;
}

export function BreadthMeter({ breadth, loading }: BreadthMeterProps) {
  const total = breadth ? breadth.advancing + breadth.declining + breadth.unchanged : 0;
  const advancingShare = total ? (breadth!.advancing / total) * 100 : 50;
  const decliningShare = total ? (breadth!.declining / total) * 100 : 50;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Market breadth</h2>
        <span className="text-xs text-content-subtle">{total ? `${total} tracked` : null}</span>
      </div>

      {loading ? (
        <Skeleton rounded="sm" className="h-10" />
      ) : (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-content/[0.06]">
            <div style={{ width: `${advancingShare}%` }} className="bg-bull" />
            <div style={{ width: `${decliningShare}%` }} className="bg-bear" />
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-content-subtle">Advancing</dt>
              <dd data-numeric className="text-lg font-semibold text-bull">
                {breadth?.advancing ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-content-subtle">Declining</dt>
              <dd data-numeric className="text-lg font-semibold text-bear">
                {breadth?.declining ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-content-subtle">Flat</dt>
              <dd data-numeric className="text-lg font-semibold text-content-muted">
                {breadth?.unchanged ?? 0}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  );
}
