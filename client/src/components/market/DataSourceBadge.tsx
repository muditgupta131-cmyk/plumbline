import { Database, Radio } from 'lucide-react';
import type { DataSource } from '@/types';
import { cn } from '@/utils/cn';

const LABELS: Record<DataSource, string> = {
  fmp: 'Financial Modeling Prep',
  finnhub: 'Finnhub',
  twelvedata: 'Twelve Data',
  alphavantage: 'Alpha Vantage',
  sample: 'Sample data',
  local: 'Plumbline universe',
};

interface DataSourceBadgeProps {
  source: DataSource | undefined;
  className?: string;
}

export function DataSourceBadge({ source, className }: DataSourceBadgeProps) {
  if (!source) return null;

  const isSample = source === 'sample';
  const label = LABELS[source] ?? source;

  return (
    <span
      title={
        isSample
          ? 'Simulated prices. Add a provider API key in server/.env to switch to live market data.'
          : `Live market data from ${label}.`
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        isSample ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400' : 'bg-bull/12 text-bull',
        className,
      )}
    >
      {isSample ? <Database className="size-3" aria-hidden /> : <Radio className="size-3" aria-hidden />}
      {isSample ? 'Sample data' : label}
    </span>
  );
}
