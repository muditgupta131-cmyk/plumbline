import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search as SearchIcon, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { Card, Input, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { DataSourceBadge, QuotePanel } from '@/components/market';
import { SearchResultRow } from '@/components/search';
import { useMarketStatus, useQuotes, useSymbolSearch, useTrendingSymbols } from '@/hooks/useMarketData';
import { useRecentSymbols } from '@/hooks/useRecentSymbols';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MARKETS, parseSecurityKey, securityKey, type Market, type SymbolMatch } from '@/types';
import { cn } from '@/utils/cn';

const MARKET_LABELS: Record<Market, string> = { IN: 'India', US: 'United States' };

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [market, setMarket] = useState<Market | 'ALL'>('ALL');
  const [activeIndex, setActiveIndex] = useState(0);
  const pushedQuery = useRef(params.get('q') ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const isStacked = useMediaQuery('(max-width: 1023px)');

  const { remember } = useRecentSymbols();
  const search = useSymbolSearch(input, 12);
  const trending = useTrendingSymbols(market === 'ALL' ? undefined : market, 12);
  const status = useMarketStatus();

  const selected = useMemo(() => parseSecurityKey(params.get('symbol') ?? ''), [params]);
  const hasQuery = input.trim().length > 0;

  const matches = useMemo<SymbolMatch[]>(() => {
    const source = hasQuery ? search.results : (trending.data?.results ?? []);
    return market === 'ALL' ? source : source.filter((match) => match.market === market);
  }, [hasQuery, search.results, trending.data, market]);

  const quotes = useQuotes(
    matches.map((match) => ({ symbol: match.symbol, exchange: match.exchange })),
    matches.length > 0,
  );

  const quoteMap = useMemo(
    () => new Map((quotes.data?.quotes ?? []).map((quote) => [securityKey(quote), quote])),
    [quotes.data],
  );

  const selectedMatch = useMemo(
    () => (selected ? matches.find((match) => securityKey(match) === securityKey(selected)) : undefined),
    [matches, selected],
  );

  useDocumentTitle(
    selected ? `${selected.symbol} · ${selected.exchange}` : 'Stock search',
    'Search any listed company by ticker or name and read its live quote, chart and profile.',
  );

  const select = useCallback(
    (match: SymbolMatch, options?: { scroll?: boolean }) => {
      remember(match);
      if (isStacked && options?.scroll !== false) {
        window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('symbol', securityKey(match));
          if (input.trim()) next.set('q', input.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    },
    [remember, setParams, input, isStacked],
  );

  useEffect(() => {
    const urlQuery = params.get('q') ?? '';
    if (urlQuery !== pushedQuery.current) {
      pushedQuery.current = urlQuery;
      setInput(urlQuery);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pushedQuery.current = input.trim();
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (input.trim()) next.set('q', input.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [input, setParams]);

  useEffect(() => {
    if (!selected && matches.length) select(matches[0], { scroll: false });
  }, [selected, matches, select]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search.query, market]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const match = matches[activeIndex];
      if (match) select(match);
    }
  };

  const listBusy = hasQuery ? search.isFetching || search.isTyping : trending.isPending;

  return (
    <div className="container py-10 sm:py-14">
      <header className="mb-8 max-w-2xl space-y-3">
        <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Stock search</p>
        <h1 className="text-display-lg text-balance">Look up any listed company</h1>
        <p className="text-content-muted">
          Search across NSE, BSE, NASDAQ, NYSE and AMEX. Pick a result to see the live quote, price history and
          company profile.
        </p>
        {status.data && !status.data.liveData ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-content-subtle">
            <DataSourceBadge source="sample" className="whitespace-nowrap" />
            Prices are simulated until a provider API key is set in <code>server/.env</code>.
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-5">
          <Input
            type="search"
            aria-label="Search by ticker or company name"
            placeholder="RELIANCE, Infosys, AAPL…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            leading={<SearchIcon className="size-4" aria-hidden />}
            trailing={listBusy ? <Loader2 className="size-4 animate-spin text-content-subtle" aria-hidden /> : null}
          />

          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by market">
            <SlidersHorizontal className="mr-1 size-3.5 text-content-subtle" aria-hidden />
            {(['ALL', ...MARKETS] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={market === option}
                onClick={() => setMarket(option)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  market === option
                    ? 'bg-content/[0.08] text-content'
                    : 'text-content-subtle hover:bg-content/5 hover:text-content',
                )}
              >
                {option === 'ALL' ? 'All markets' : MARKET_LABELS[option]}
              </button>
            ))}
          </div>

          <Card className="p-2">
            {!hasQuery ? (
              <p className="flex items-center gap-1.5 px-3 py-2 text-eyebrow uppercase text-content-subtle">
                <TrendingUp className="size-3" aria-hidden /> Popular right now
              </p>
            ) : null}

            {search.isError ? (
              <QueryError error={search.error} onRetry={() => search.refetch()} className="p-4" />
            ) : listBusy && !matches.length ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : matches.length ? (
              <ul role="listbox" aria-label="Search results">
                {matches.map((match, index) => (
                  <SearchResultRow
                    key={securityKey(match)}
                    id={`result-${index}`}
                    match={match}
                    quote={quoteMap.get(securityKey(match))}
                    quoteLoading={quotes.isPending}
                    active={
                      selected ? securityKey(match) === securityKey(selected) : index === activeIndex
                    }
                    onSelect={() => select(match)}
                    onHover={() => setActiveIndex(index)}
                  />
                ))}
              </ul>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<SearchIcon className="size-5" aria-hidden />}
                  title={`No match for “${search.query}”`}
                  description="Try a ticker such as RELIANCE, TCS or NVDA, or type the full company name."
                />
              </div>
            )}
          </Card>
        </section>

        <section ref={panelRef} className="scroll-mt-20 lg:col-span-7">
          {selected ? (
            <QuotePanel security={selected} match={selectedMatch} />
          ) : (
            <Card className="flex min-h-[420px] items-center justify-center p-8">
              <EmptyState
                icon={<SearchIcon className="size-5" aria-hidden />}
                title="Pick a company"
                description="Choose a result on the left to load its live quote, price chart and company profile."
              />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
