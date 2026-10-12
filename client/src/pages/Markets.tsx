import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { QueryError } from '@/components/feedback';
import {
  BreadthMeter,
  DataSourceBadge,
  IndexCard,
  IndexCardSkeleton,
  MarketSessionBadge,
  MoversTable,
  SectorHeat,
  TickerTape,
} from '@/components/market';
import { useIndices, useMarketOverview } from '@/hooks/useMarketData';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MARKETS, securityKey, type Market } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const MARKET_LABELS: Record<Market, string> = { IN: 'India', US: 'United States' };

export default function MarketsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  // An explicit ?market= wins; otherwise fall back to the home market on the profile.
  const requested = params.get('market');
  const market: Market =
    requested === 'US' || requested === 'IN' ? requested : (user?.preferences.defaultMarket ?? 'IN');

  const overview = useMarketOverview(market, 8);
  const tape = useIndices();

  useDocumentTitle(
    `${MARKET_LABELS[market]} market overview`,
    'Indices, top gainers and losers, sector performance and market breadth across India and the United States.',
  );

  const setMarket = (next: Market) => {
    const search = new URLSearchParams(params);
    search.set('market', next);
    setParams(search, { replace: true });
  };

  return (
    <>
      <TickerTape indices={tape.data?.indices ?? []} />

      <div className="container py-10 sm:py-12">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Markets</p>
            <h1 className="text-display-lg text-balance">{MARKET_LABELS[market]} market overview</h1>
            <div className="flex flex-wrap items-center gap-2">
              {overview.data?.sessions.map((session) => (
                <MarketSessionBadge key={session.exchange} session={session} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-hairline p-1" role="group" aria-label="Market">
              {MARKETS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={market === option}
                  onClick={() => setMarket(option)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    market === option ? 'bg-brand-600 text-white' : 'text-content-muted hover:text-content',
                  )}
                >
                  {MARKET_LABELS[option]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-content-subtle">
              <DataSourceBadge source={overview.data?.indices[0]?.source} />
              {overview.data ? <span>Updated {formatRelativeTime(overview.data.asOf)}</span> : null}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Refresh market data"
                loading={overview.isFetching}
                onClick={() => overview.refetch()}
                icon={<RefreshCw className="size-3.5" aria-hidden />}
              />
            </div>
          </div>
        </header>

        {overview.isError ? (
          <QueryError error={overview.error} onRetry={() => overview.refetch()} />
        ) : (
          <div className="space-y-6">
            <section aria-label="Indices" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.isPending
                ? Array.from({ length: 3 }).map((_, index) => <IndexCardSkeleton key={index} />)
                : overview.data.indices.map((index) => <IndexCard key={index.id} index={index} />)}
            </section>

            <div className="grid gap-6 lg:grid-cols-12">
              <section aria-label="Market movers" className="lg:col-span-7">
                <MoversTable movers={overview.data?.movers} loading={overview.isPending} />
              </section>

              <div className="space-y-6 lg:col-span-5">
                <BreadthMeter breadth={overview.data?.movers.breadth} loading={overview.isPending} />
                <SectorHeat sectors={overview.data?.sectors} loading={overview.isPending} />
              </div>
            </div>

            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-base font-semibold">Trending on {MARKET_LABELS[market]}</h2>
              <div className="flex flex-wrap gap-2">
                {overview.data?.trending.map((match) => (
                  <Link
                    key={securityKey(match)}
                    to={`/stocks/${match.exchange}/${encodeURIComponent(match.symbol)}`}
                    className="rounded-full border border-hairline px-3.5 py-1.5 text-sm transition-colors hover:border-brand-500/50 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <span data-numeric className="font-medium">
                      {match.symbol}
                    </span>
                    <span className="ml-2 text-xs text-content-subtle">{match.exchange}</span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
