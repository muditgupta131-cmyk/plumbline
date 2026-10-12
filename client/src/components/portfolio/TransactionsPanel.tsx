import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui';
import { ExchangePill } from '@/components/market';
import type { PortfolioTransaction, TransactionType } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

interface TransactionsPanelProps {
  transactions: PortfolioTransaction[] | undefined;
  loading?: boolean;
  removing?: boolean;
  onAdd: () => void;
  onRemove: (transaction: PortfolioTransaction) => void;
}

const TYPE_STYLE: Record<TransactionType, { label: string; icon: typeof ArrowDownLeft; className: string }> = {
  BUY: { label: 'Buy', icon: ArrowDownLeft, className: 'bg-bull/12 text-bull' },
  SELL: { label: 'Sell', icon: ArrowUpRight, className: 'bg-bear/12 text-bear' },
  DIVIDEND: { label: 'Dividend', icon: Coins, className: 'bg-accent-600/12 text-accent-600 dark:text-accent-400' },
};

export function TransactionsPanel({ transactions, loading, removing, onAdd, onRemove }: TransactionsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = transactions ?? [];
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Transactions</h3>
          <p className="text-xs text-content-subtle">
            Every buy, sell and dividend. These drive FIFO cost, realised gains and XIRR.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd} icon={<Plus className="size-4" aria-hidden />}>
          Record transaction
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : rows.length ? (
        <>
          <ul className="divide-y divide-hairline">
            {visible.map((transaction) => {
              const style = TYPE_STYLE[transaction.type];
              const gross = transaction.quantity * transaction.price;

              return (
                <li key={transaction.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', style.className)}>
                    <style.icon className="size-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span className={transaction.assetType === 'MUTUAL_FUND' ? 'truncate' : ''} data-numeric={transaction.assetType === 'EQUITY' ? '' : undefined}>
                        {transaction.symbol}
                      </span>
                      {transaction.exchange ? <ExchangePill exchange={transaction.exchange} /> : null}
                    </p>
                    <p className="text-xs text-content-subtle">
                      {style.label} · {formatDate(transaction.date)}
                      {transaction.type !== 'DIVIDEND'
                        ? ` · ${formatNumber(transaction.quantity, 3)} @ ${formatCurrency(transaction.price, transaction.currency)}`
                        : ''}
                      {transaction.fees ? ` · fees ${formatCurrency(transaction.fees, transaction.currency)}` : ''}
                    </p>
                  </div>

                  <span
                    data-numeric
                    className={cn(
                      'shrink-0 text-sm font-medium',
                      transaction.type === 'BUY' ? 'text-content-muted' : 'text-bull',
                    )}
                  >
                    {transaction.type === 'BUY' ? '−' : '+'}
                    {formatCurrency(transaction.type === 'DIVIDEND' ? transaction.price * (transaction.quantity || 1) : gross, transaction.currency, 0)}
                  </span>

                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => onRemove(transaction)}
                    aria-label={`Delete ${style.label} of ${transaction.symbol}`}
                    className="rounded-full p-1.5 text-content-subtle transition-colors hover:bg-bear/10 hover:text-bear disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          {rows.length > 8 ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {expanded ? 'Show less' : `Show all ${rows.length}`}
            </button>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-hairline p-6 text-center">
          <p className="text-sm font-medium">No transactions recorded</p>
          <p className="mt-1 text-sm text-content-muted">
            Holdings you add directly use their average cost. Record the actual buys and sells to get FIFO realised
            gains and a money-weighted return.
          </p>
        </div>
      )}
    </Card>
  );
}
