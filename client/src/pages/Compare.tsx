import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompareArrows, Plus, Search } from 'lucide-react';
import { Button, Card, Input, Modal } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { ExchangePill, SymbolLogo } from '@/components/market';
import { CompareTable, IndexedChart } from '@/components/compare';
import { useComparison, useSymbolSearch, useTrendingSymbols } from '@/hooks/useMarketData';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseSecurityKey, securityKey, type CandleRange, type SecurityRef, type SymbolMatch } from '@/types';

const MAX_COMPARE = 4;

export default function ComparePage() {
  useDocumentTitle('Compare companies', 'Put up to four companies side by side on valuation, margins, growth and debt.');

  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState<CandleRange>('1Y');
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const refs = useMemo<SecurityRef[]>(() => {
    const raw = params.get('symbols');
    if (!raw) return [];
    return raw
      .split(',')
      .map((entry) => parseSecurityKey(entry.trim()))
      .filter((ref): ref is SecurityRef => ref !== null)
      .slice(0, MAX_COMPARE);
  }, [params]);

  const comparison = useComparison(refs);
  const search = useSymbolSearch(query, 6);
  const trending = useTrendingSymbols(undefined, 6);

  const setRefs = (next: SecurityRef[]) => {
    const search = new URLSearchParams(params);
    if (next.length) search.set('symbols', next.map(securityKey).join(','));
    else search.delete('symbols');
    setParams(search, { replace: true });
  };

  const add = (match: SymbolMatch) => {
    const ref = { symbol: match.symbol, exchange: match.exchange };
    if (refs.some((entry) => securityKey(entry) === securityKey(ref))) return;
    setRefs([...refs, ref].slice(0, MAX_COMPARE));
    setPicking(false);
    setQuery('');
  };

  const suggestions = query.trim().length > 1 ? search.results : (trending.data?.results ?? []);

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Compare</p>
          <h1 className="text-display-md">Side by side</h1>
          <p className="text-sm text-content-subtle">
            Up to four companies on valuation, profitability, growth, debt and relative performance.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setPicking(true)}
          disabled={refs.length >= MAX_COMPARE}
          icon={<Plus className="size-4" aria-hidden />}
        >
          {refs.length >= MAX_COMPARE ? 'Four is the limit' : 'Add a company'}
        </Button>
      </header>

      {comparison.isError ? (
        <QueryError error={comparison.error} onRetry={() => comparison.refetch()} />
      ) : refs.length ? (
        <>
          {comparison.data?.failed.length ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm text-amber-700 dark:text-amber-400">
              No data for {comparison.data.failed.join(', ')}.
            </p>
          ) : null}

          <CompareTable
            entries={comparison.data?.entries ?? []}
            loading={comparison.isPending}
            onRemove={(entry) =>
              setRefs(refs.filter((ref) => securityKey(ref) !== `${entry.exchange}:${entry.symbol}`))
            }
          />

          <IndexedChart refs={refs} range={range} onRangeChange={setRange} />
        </>
      ) : (
        <Card className="p-10">
          <EmptyState
            icon={<GitCompareArrows className="size-5" aria-hidden />}
            title="Pick two companies to start"
            description="Anything listed on NSE, BSE, NASDAQ, NYSE or AMEX. The table works from one, but it earns its keep at two or more."
            action={
              <Button size="sm" onClick={() => setPicking(true)}>
                Add a company
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={picking}
        onClose={() => {
          setPicking(false);
          setQuery('');
        }}
        title="Add a company"
        description={`${refs.length} of ${MAX_COMPARE} slots used.`}
      >
        <div className="space-y-3">
          <Input
            placeholder="RELIANCE, Infosys, AAPL…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leading={<Search className="size-4" aria-hidden />}
            autoFocus
          />

          <ul className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
            {suggestions.map((match) => {
              const already = refs.some((ref) => securityKey(ref) === securityKey(match));

              return (
                <li key={securityKey(match)}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => add(match)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-content/[0.04] disabled:opacity-40"
                  >
                    <SymbolLogo symbol={match.symbol} name={match.name} logoUrl={match.logoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span data-numeric className="text-sm font-semibold">
                          {match.symbol}
                        </span>
                        <ExchangePill exchange={match.exchange} />
                      </span>
                      <span className="block truncate text-xs text-content-muted">{match.name}</span>
                    </span>
                    {already ? <span className="text-xs text-content-subtle">added</span> : null}
                  </button>
                </li>
              );
            })}

            {!suggestions.length ? (
              <li className="px-3 py-6 text-center text-sm text-content-subtle">No match yet.</li>
            ) : null}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
