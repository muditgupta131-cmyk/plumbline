import { Delta, Skeleton } from '@/components/ui';
import { DataSourceBadge, ExchangePill, MarketSessionBadge, SymbolLogo } from '@/components/market';
import type { CompanyProfile, ExchangeSession, Quote } from '@/types';
import { formatCurrency, formatRelativeTime } from '@/utils/format';

interface StockHeaderProps {
  symbol: string;
  quote: Quote | undefined;
  profile: CompanyProfile | null | undefined;
  session: ExchangeSession | undefined;
  loading?: boolean;
}

export function StockHeader({ symbol, quote, profile, session, loading }: StockHeaderProps) {
  const currency = quote?.currency ?? 'USD';
  const name = profile?.name ?? quote?.symbol ?? symbol;

  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <SymbolLogo symbol={symbol} name={name} logoUrl={profile?.logoUrl} size="lg" />

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold sm:text-3xl">{name}</h1>
            {quote ? <ExchangePill exchange={quote.exchange} /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-muted">
            <span data-numeric className="font-medium">
              {symbol}
            </span>
            {profile?.sector ? <span>{profile.sector}</span> : null}
            {profile?.industry ? <span className="text-content-subtle">· {profile.industry}</span> : null}
          </div>
          {session ? <MarketSessionBadge session={session} /> : null}
        </div>
      </div>

      <div className="shrink-0 space-y-2 md:text-right">
        {loading || !quote ? (
          <Skeleton className="h-11 w-44 md:ml-auto" />
        ) : (
          <>
            <p data-numeric className="text-display-md leading-none">
              {formatCurrency(quote.price, currency)}
            </p>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Delta value={quote.changePercent} absolute={quote.change} size="md" />
              <DataSourceBadge source={quote.source} />
            </div>
            <p className="text-xs text-content-subtle">Updated {formatRelativeTime(quote.asOf)}</p>
          </>
        )}
      </div>
    </header>
  );
}
