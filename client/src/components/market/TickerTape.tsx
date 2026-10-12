import { Link } from 'react-router-dom';
import type { IndexQuote } from '@/types';
import { changeTone, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

interface TickerTapeProps {
  indices: IndexQuote[];
  className?: string;
}

function Item({ index }: { index: IndexQuote }) {
  const tone = changeTone(index.changePercent);

  return (
    <span className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
      <span className="font-medium">{index.short}</span>
      <span data-numeric className="text-content-muted">
        {formatNumber(index.value)}
      </span>
      <span
        data-numeric
        className={cn(
          'text-xs font-medium',
          tone === 'up' && 'text-bull',
          tone === 'down' && 'text-bear',
          tone === 'flat' && 'text-content-subtle',
        )}
      >
        {formatPercent(index.changePercent)}
      </span>
    </span>
  );
}

export function TickerTape({ indices, className }: TickerTapeProps) {
  if (!indices.length) return null;

  return (
    <div
      className={cn('group relative overflow-hidden border-y border-hairline bg-surface/60', className)}
      aria-label="Index prices"
    >
      <div className="flex w-max animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center divide-x divide-hairline" aria-hidden={copy === 1}>
            {indices.map((index) => (
              <Link key={`${copy}-${index.id}`} to="/markets" className="transition-colors hover:bg-content/[0.03]">
                <Item index={index} />
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
