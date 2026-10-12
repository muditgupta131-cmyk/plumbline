import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import { ExchangePill, SymbolLogo } from '@/components/market';
import type { ComparisonEntry } from '@/types';
import { METRIC_GROUPS, bestIndex } from './metrics';
import { cn } from '@/utils/cn';

interface CompareTableProps {
  entries: ComparisonEntry[];
  loading?: boolean;
  onRemove: (entry: ComparisonEntry) => void;
}

export function CompareTable({ entries, loading, onRemove }: CompareTableProps) {
  if (loading) {
    return (
      <Card className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </Card>
    );
  }

  if (!entries.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="w-48 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-content-subtle">
                Metric
              </th>
              {entries.map((entry) => (
                <th key={`${entry.exchange}:${entry.symbol}`} scope="col" className="px-4 py-3 text-left">
                  <div className="flex items-start gap-2.5">
                    <SymbolLogo symbol={entry.symbol} name={entry.name} logoUrl={entry.logoUrl} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={`/stocks/${entry.exchange}/${encodeURIComponent(entry.symbol)}`}
                        className="flex items-center gap-1.5 hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        <span data-numeric className="font-semibold">
                          {entry.symbol}
                        </span>
                        <ExchangePill exchange={entry.exchange} />
                      </Link>
                      <p className="max-w-36 truncate text-xs font-normal text-content-subtle">{entry.sector ?? entry.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(entry)}
                      aria-label={`Remove ${entry.symbol} from the comparison`}
                      className="ml-auto rounded-full p-1 text-content-subtle transition-colors hover:bg-content/5 hover:text-content"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {METRIC_GROUPS.map((group) => (
              // The fragment is the list child, so the key belongs on it rather than the first row.
              <Fragment key={group.title}>
                <tr className="border-y border-hairline bg-canvas/40">
                  <th
                    scope="colgroup"
                    colSpan={entries.length + 1}
                    className="px-4 py-2 text-left text-xs font-semibold"
                  >
                    {group.title}
                    <span className="ml-2 font-normal text-content-subtle">{group.caption}</span>
                  </th>
                </tr>

                {group.rows.map((row) => {
                  const best = bestIndex(row, entries);

                  return (
                    <tr key={`${group.title}-${row.label}`} className="border-b border-hairline/60 last:border-0">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal text-content-muted">
                        {row.label}
                      </th>
                      {entries.map((entry, index) => (
                        <td
                          key={`${entry.exchange}:${entry.symbol}-${row.label}`}
                          data-numeric
                          className={cn(
                            'px-4 py-2.5 font-medium',
                            best === index && 'text-bull',
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {row.format(entry)}
                            {best === index ? <Check className="size-3.5" aria-label="Best on this measure" /> : null}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs text-content-subtle">
        A tick marks the best reading on that row — cheapest on valuation, highest on returns, least levered on debt.
        It is a comparison, not a recommendation: a low P/E often reflects a business the market expects to shrink.
      </p>
    </Card>
  );
}
