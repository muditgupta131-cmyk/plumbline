import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Delta, Skeleton } from '@/components/ui';
import type { MoversResponse, UniverseRow } from '@/types';
import { securityKey } from '@/types';
import { formatCurrency, formatVolume } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ExchangePill } from './ExchangePill';

type Tab = 'gainers' | 'losers' | 'active';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'gainers', label: 'Top gainers' },
  { id: 'losers', label: 'Top losers' },
  { id: 'active', label: 'Most active' },
];

function Row({ row, rank }: { row: UniverseRow; rank: number }) {
  return (
    <Link
      to={`/stocks/${row.exchange}/${encodeURIComponent(row.symbol)}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-content/[0.04]"
    >
      <span data-numeric className="w-4 shrink-0 text-xs text-content-subtle">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span data-numeric className="truncate text-sm font-semibold">
            {row.symbol}
          </span>
          <ExchangePill exchange={row.exchange} />
        </div>
        <p className="truncate text-xs text-content-muted">{row.name}</p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-[11px] uppercase tracking-wide text-content-subtle">Vol</p>
        <p data-numeric className="text-xs font-medium">
          {formatVolume(row.volume)}
        </p>
      </div>

      <div className="w-28 shrink-0 text-right">
        <p data-numeric className="text-sm font-medium">
          {formatCurrency(row.price, row.currency)}
        </p>
        <Delta value={row.changePercent} className="text-xs" />
      </div>
    </Link>
  );
}

export function MoversTable({ movers, loading }: { movers?: MoversResponse; loading?: boolean }) {
  const [tab, setTab] = useState<Tab>('gainers');
  const rows = movers?.[tab] ?? [];

  return (
    <Card className="p-2">
      <div role="tablist" aria-label="Market movers" className="flex items-center gap-1 p-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              tab === item.id
                ? 'bg-content/[0.08] text-content'
                : 'text-content-subtle hover:bg-content/5 hover:text-content',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : rows.length ? (
        <div>
          {rows.map((row, index) => (
            <Row key={securityKey(row)} row={row} rank={index + 1} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-content-muted">
          Nothing is moving in this direction right now.
        </p>
      )}
    </Card>
  );
}
