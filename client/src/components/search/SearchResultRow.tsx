import { Delta, Skeleton } from '@/components/ui';
import { ExchangePill, SymbolLogo } from '@/components/market';
import { formatCurrency } from '@/utils/format';
import type { Quote, SymbolMatch } from '@/types';
import { cn } from '@/utils/cn';

interface SearchResultRowProps {
  id: string;
  match: SymbolMatch;
  quote?: Quote;
  quoteLoading?: boolean;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export function SearchResultRow({
  id,
  match,
  quote,
  quoteLoading,
  active,
  onSelect,
  onHover,
}: SearchResultRowProps) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150',
        active ? 'bg-content/[0.06]' : 'hover:bg-content/[0.04]',
      )}
    >
      <SymbolLogo symbol={match.symbol} name={match.name} logoUrl={match.logoUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span data-numeric className="truncate text-sm font-semibold">
            {match.symbol}
          </span>
          <ExchangePill exchange={match.exchange} />
        </div>
        <p className="truncate text-xs text-content-muted">
          {match.name}
          {match.sector ? <span className="text-content-subtle"> · {match.sector}</span> : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {quote ? (
          <>
            <p data-numeric className="text-sm font-medium">
              {formatCurrency(quote.price, quote.currency)}
            </p>
            <Delta value={quote.changePercent} className="text-xs" />
          </>
        ) : quoteLoading ? (
          <div className="space-y-1.5">
            <Skeleton rounded="sm" className="ml-auto h-3.5 w-16" />
            <Skeleton rounded="sm" className="ml-auto h-3 w-12" />
          </div>
        ) : null}
      </div>
    </li>
  );
}
