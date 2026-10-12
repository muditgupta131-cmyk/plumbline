import { Card, Skeleton } from '@/components/ui';
import type { SectorPerformance } from '@/types';
import { changeTone, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

interface SectorHeatProps {
  sectors?: SectorPerformance[];
  loading?: boolean;
}

export function SectorHeat({ sectors, loading }: SectorHeatProps) {
  const peak = Math.max(1, ...(sectors ?? []).map((sector) => Math.abs(sector.changePercent)));

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Sector performance</h2>
        <span className="text-xs text-content-subtle">Average move</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} rounded="sm" className="h-8" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sectors?.map((sector) => {
            const tone = changeTone(sector.changePercent);
            const width = `${Math.max(4, (Math.abs(sector.changePercent) / peak) * 100)}%`;

            return (
              <li key={sector.sector} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">
                    {sector.sector}
                    <span className="ml-1.5 text-xs text-content-subtle">{sector.count}</span>
                  </span>
                  <span
                    data-numeric
                    className={cn(
                      'shrink-0 text-xs font-medium',
                      tone === 'up' && 'text-bull',
                      tone === 'down' && 'text-bear',
                      tone === 'flat' && 'text-content-subtle',
                    )}
                  >
                    {formatPercent(sector.changePercent)}
                  </span>
                </div>

                <div className="flex h-1.5 items-center overflow-hidden rounded-full bg-content/[0.06]">
                  <div
                    style={{ width }}
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500 ease-swift',
                      tone === 'up' && 'bg-bull',
                      tone === 'down' && 'bg-bear',
                      tone === 'flat' && 'bg-content-subtle',
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
