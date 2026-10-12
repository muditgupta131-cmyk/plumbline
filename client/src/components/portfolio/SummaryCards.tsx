import { Card, Delta, Skeleton } from '@/components/ui';
import type { PortfolioTotals } from '@/types';
import { formatCurrency, formatMarketCap, formatRate } from '@/utils/format';
import { cn } from '@/utils/cn';

interface SummaryCardsProps {
  totals: PortfolioTotals | undefined;
  currency: string;
  loading?: boolean;
}

export function SummaryCards({ totals, currency, loading }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Current value',
      value: formatCurrency(totals?.value, currency, 0),
      sub: totals ? `${totals.pricedHoldings} of ${totals.holdings} priced` : null,
    },
    {
      label: 'Invested',
      value: formatCurrency(totals?.invested, currency, 0),
      // XIRR is only computed for positions that have a transaction ledger. When some holdings were
      // entered as a balance instead, saying so stops a negative XIRR from looking like it disagrees
      // with a positive total P&L — it is measuring a different subset, not contradicting it.
      sub:
        totals?.xirr !== null && totals?.xirr !== undefined
          ? totals.ledgerPositions < totals.holdings
            ? `${formatRate(totals.xirr)} XIRR · ${totals.ledgerPositions} of ${totals.holdings} positions`
            : `${formatRate(totals.xirr)} XIRR`
          : totals?.cagr !== null && totals?.cagr !== undefined
            ? `${formatRate(totals.cagr)} annualised`
            : null,
    },
    {
      label: 'Total P&L',
      value: formatCurrency(totals?.pnl, currency, 0),
      delta: totals?.pnlPercent,
      amount: totals?.pnl,
    },
    {
      label: "Today's move",
      value: formatCurrency(totals?.dayPnl, currency, 0),
      delta: totals?.dayPnlPercent,
      amount: totals?.dayPnl,
    },
    totals?.ledgerPositions
      ? {
          label: 'Realised P&L',
          value: formatCurrency(totals.realisedGain, currency, 0),
          amount: totals.realisedGain,
          sub: totals.dividendsReceived
            ? `+ ${formatCurrency(totals.dividendsReceived, currency, 0)} dividends`
            : 'Booked on sales, FIFO',
        }
      : {
          label: 'Dividend income',
          value: formatMarketCap(totals?.annualDividend ?? null, currency),
          sub: totals ? `${formatRate(totals.dividendYield)} yield` : null,
        },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="p-5">
          <p className="text-[11px] uppercase tracking-wide text-content-subtle">{card.label}</p>

          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p
              data-numeric
              className={cn(
                'mt-1.5 truncate text-xl font-semibold',
                card.amount !== undefined && card.amount < 0 && 'text-bear',
                card.amount !== undefined && card.amount > 0 && 'text-bull',
              )}
            >
              {card.value}
            </p>
          )}

          <div className="mt-1 h-5 text-xs text-content-subtle">
            {loading ? null : card.delta !== undefined && card.delta !== null ? (
              <Delta value={card.delta} className="text-xs" />
            ) : (
              card.sub
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
