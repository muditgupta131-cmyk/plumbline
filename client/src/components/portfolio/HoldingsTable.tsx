import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, Delta, Skeleton } from '@/components/ui';
import { ExchangePill } from '@/components/market';
import type { ValuedHolding } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

interface HoldingsTableProps {
  holdings: ValuedHolding[] | undefined;
  currency: string;
  loading?: boolean;
  onEdit: (holding: ValuedHolding) => void;
  onRemove: (holding: ValuedHolding) => void;
}

const HEADERS = ['Holding', 'Qty', 'Avg cost', 'Price', 'Value', 'P&L', 'Weight', ''];

export function HoldingsTable({ holdings, currency, loading, onEdit, onRemove }: HoldingsTableProps) {
  if (loading) {
    return (
      <Card className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </Card>
    );
  }

  if (!holdings?.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-content-subtle',
                    header !== 'Holding' && header !== '' && 'text-right',
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {holdings.map((holding) => (
              <tr key={holding.id} className="transition-colors hover:bg-content/[0.02]">
                <td className="max-w-[280px] px-4 py-3">
                  {holding.assetType === 'MUTUAL_FUND' ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{holding.name}</span>
                        <span className="shrink-0 rounded-md bg-accent-600/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-400">
                          Fund
                        </span>
                      </span>
                      <span className="truncate text-xs text-content-subtle">
                        {holding.fundHouse ?? holding.sector}
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={`/stocks/${holding.exchange}/${encodeURIComponent(holding.symbol)}`}
                      className="group flex flex-col gap-0.5"
                    >
                      <span className="flex items-center gap-2">
                        <span data-numeric className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {holding.symbol}
                        </span>
                        {holding.exchange ? <ExchangePill exchange={holding.exchange} /> : null}
                      </span>
                      <span className="truncate text-xs text-content-subtle">{holding.name}</span>
                    </Link>
                  )}
                </td>

                <td data-numeric className="px-4 py-3 text-right">
                  {formatNumber(holding.quantity, 4)}
                </td>

                <td data-numeric className="px-4 py-3 text-right text-content-muted">
                  {formatCurrency(holding.avgBuyPrice, holding.currency)}
                </td>

                <td className="px-4 py-3 text-right">
                  {holding.priced ? (
                    <>
                      <span data-numeric className="block">
                        {formatCurrency(holding.price, holding.currency)}
                      </span>
                      {holding.assetType === 'MUTUAL_FUND' ? (
                        <span className="text-xs text-content-subtle">
                          NAV {holding.navDate ? formatDate(holding.navDate) : ''}
                        </span>
                      ) : !holding.priced ? (
                        <span
                          title="No market price for this listing yet — a share allotted in an IPO has none until it lists."
                          className="text-xs text-amber-600 dark:text-amber-400"
                        >
                          not priced
                        </span>
                      ) : (
                        <Delta value={holding.dayChangePercent} className="text-xs" />
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-content-subtle">No price</span>
                  )}
                </td>

                <td data-numeric className="px-4 py-3 text-right font-medium">
                  {formatCurrency(holding.value, currency, 0)}
                </td>

                <td className="px-4 py-3 text-right">
                  <span
                    data-numeric
                    className={cn(
                      'block font-medium',
                      (holding.pnl ?? 0) > 0 && 'text-bull',
                      (holding.pnl ?? 0) < 0 && 'text-bear',
                    )}
                  >
                    {formatCurrency(holding.pnl, currency, 0)}
                  </span>
                  <Delta value={holding.pnlPercent} className="text-xs" />
                </td>

                <td className="px-4 py-3 text-right">
                  <span data-numeric className="block text-content-muted">
                    {holding.weight.toFixed(1)}%
                  </span>
                  {holding.xirr !== null ? (
                    <span data-numeric className="text-xs text-content-subtle" title="Money-weighted return from your recorded transactions">
                      {holding.xirr > 0 ? '+' : ''}
                      {holding.xirr}% XIRR
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(holding)}
                      aria-label={`Edit ${holding.symbol}`}
                      className="rounded-full p-1.5 text-content-subtle transition-colors hover:bg-content/5 hover:text-content"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(holding)}
                      aria-label={`Remove ${holding.symbol}`}
                      className="rounded-full p-1.5 text-content-subtle transition-colors hover:bg-bear/10 hover:text-bear"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
