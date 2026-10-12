import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Filter, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, Card, Delta, Input, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { ExchangePill } from '@/components/market';
import { useScreener } from '@/hooks/useScreener';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MARKETS, type Market, type ScreenerQuery, type ScreenerSortField } from '@/types';
import { formatCurrency, formatMarketCap, formatMultiple, formatPercent, formatRate } from '@/utils/format';
import { cn } from '@/utils/cn';

const COLUMNS: Array<{ field: ScreenerSortField; label: string; render: (row: import('@/types').ScreenerRow) => string }> = [
  { field: 'price', label: 'Price', render: (row) => formatCurrency(row.price, row.currency) },
  { field: 'marketCap', label: 'Market cap', render: (row) => formatMarketCap(row.marketCap, row.currency) },
  { field: 'peRatio', label: 'P/E', render: (row) => formatMultiple(row.peRatio) },
  { field: 'roe', label: 'ROE', render: (row) => formatRate(row.roe) },
  { field: 'netMargin', label: 'Net margin', render: (row) => formatRate(row.netMargin) },
  { field: 'revenueGrowth', label: 'Rev growth', render: (row) => formatPercent(row.revenueGrowth) },
  { field: 'dividendYield', label: 'Div yield', render: (row) => formatRate(row.dividendYield) },
];

const PRESETS: Array<{ label: string; description: string; filters: Partial<ScreenerQuery> }> = [
  {
    label: 'Quality at a fair price',
    description: 'P/E under 25, ROE above 15%, modest debt',
    filters: { maxPeRatio: 25, minRoe: 15, maxDebtToEquity: 1 },
  },
  {
    label: 'Dividend payers',
    description: 'Yield above 2% with real profitability',
    filters: { minDividendYield: 2, minRoe: 10, sortBy: 'dividendYield', sortDir: 'desc' },
  },
  {
    label: 'Growing fast',
    description: 'Revenue growth above 15%',
    filters: { minRevenueGrowth: 15, sortBy: 'revenueGrowth', sortDir: 'desc' },
  },
  {
    label: 'Near their lows',
    description: 'In the bottom third of the 52 week range',
    filters: { maxRangePosition: 33, sortBy: 'changePercent', sortDir: 'asc' },
  },
];

const EMPTY: ScreenerQuery = { sortBy: 'marketCap', sortDir: 'desc', page: 1, limit: 25 };

export default function ScreenerPage() {
  useDocumentTitle('Stock screener', 'Filter companies on valuation, profitability, growth, debt and dividend yield.');

  const [query, setQuery] = useState<ScreenerQuery>(EMPTY);
  const result = useScreener(query);

  const patch = (next: Partial<ScreenerQuery>) => setQuery((current) => ({ ...current, page: 1, ...next }));

  const numberField = (
    label: string,
    key: keyof ScreenerQuery,
    placeholder: string,
    suffix?: string,
  ) => (
    <Input
      label={label}
      type="number"
      step="any"
      placeholder={placeholder}
      value={(query[key] as number | undefined) ?? ''}
      hint={suffix}
      onChange={(event) =>
        patch({ [key]: event.target.value === '' ? undefined : Number(event.target.value) } as Partial<ScreenerQuery>)
      }
    />
  );

  const sortBy = (field: ScreenerSortField) =>
    patch({ sortBy: field, sortDir: query.sortBy === field && query.sortDir === 'desc' ? 'asc' : 'desc' });

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Screener</p>
        <h1 className="text-display-md">Filter the universe</h1>
        <p className="text-sm text-content-subtle">
          Valuation, profitability, growth, debt and yield across {result.data?.universe ?? '…'} companies.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setQuery({ ...EMPTY, ...preset.filters })}
            className="rounded-xl border border-hairline px-3.5 py-2 text-left transition-colors hover:border-brand-500/50"
          >
            <span className="block text-sm font-medium">{preset.label}</span>
            <span className="block text-xs text-content-subtle">{preset.description}</span>
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4 text-content-subtle" aria-hidden />
            Filters
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setQuery(EMPTY)} icon={<RotateCcw className="size-3.5" aria-hidden />}>
            Reset
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Market</span>
            <div className="flex gap-1 rounded-xl border border-hairline p-1">
              {(['ALL', ...MARKETS] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={(query.market ?? 'ALL') === option}
                  onClick={() => patch({ market: option === 'ALL' ? undefined : (option as Market) })}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                    (query.market ?? 'ALL') === option
                      ? 'bg-content/[0.08] text-content'
                      : 'text-content-muted hover:text-content',
                  )}
                >
                  {option === 'ALL' ? 'All' : option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="screener-sector" className="block text-sm font-medium">
              Sector
            </label>
            <select
              id="screener-sector"
              value={query.sector ?? ''}
              onChange={(event) => patch({ sector: event.target.value || undefined })}
              className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Every sector</option>
              {result.data?.sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          {numberField('Max P/E', 'maxPeRatio', 'e.g. 25')}
          {numberField('Min ROE', 'minRoe', 'e.g. 15', '%')}
          {numberField('Max debt/equity', 'maxDebtToEquity', 'e.g. 1')}
          {numberField('Min revenue growth', 'minRevenueGrowth', 'e.g. 10', '%')}
          {numberField('Min dividend yield', 'minDividendYield', 'e.g. 2', '%')}
          {numberField('Max 52w range position', 'maxRangePosition', 'e.g. 40', '% — lower means nearer its low')}
        </div>
      </Card>

      {result.isError ? (
        <QueryError error={result.error} onRetry={() => result.refetch()} />
      ) : result.isPending ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </Card>
      ) : result.data.rows.length ? (
        <Card className="overflow-hidden">
          <p className="border-b border-hairline px-4 py-2.5 text-xs text-content-subtle">
            {result.data.total} of {result.data.universe} companies match
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-content-subtle">
                    Company
                  </th>
                  {COLUMNS.map((column) => (
                    <th key={column.field} scope="col" className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => sortBy(column.field)}
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition-colors',
                          query.sortBy === column.field ? 'text-content' : 'text-content-subtle hover:text-content',
                        )}
                      >
                        {column.label}
                        {query.sortBy === column.field ? (
                          query.sortDir === 'desc' ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-hairline">
                {result.data.rows.map((row) => (
                  <tr key={`${row.exchange}:${row.symbol}`} className="transition-colors hover:bg-content/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        to={`/stocks/${row.exchange}/${encodeURIComponent(row.symbol)}`}
                        className="group flex flex-col gap-0.5"
                      >
                        <span className="flex items-center gap-2">
                          <span data-numeric className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {row.symbol}
                          </span>
                          <ExchangePill exchange={row.exchange} />
                        </span>
                        <span className="truncate text-xs text-content-subtle">
                          {row.name} · {row.sector}
                        </span>
                      </Link>
                    </td>

                    {COLUMNS.map((column) => (
                      <td key={column.field} data-numeric className="px-4 py-3 text-right">
                        {column.field === 'price' ? (
                          <>
                            <span className="block">{column.render(row)}</span>
                            <Delta value={row.changePercent} className="text-xs" />
                          </>
                        ) : (
                          column.render(row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.data.total > result.data.limit ? (
            <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
              <Button
                size="sm"
                variant="ghost"
                disabled={query.page <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-xs text-content-subtle">
                Page {result.data.page} of {Math.ceil(result.data.total / result.data.limit)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={query.page >= Math.ceil(result.data.total / result.data.limit)}
                onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="p-10">
          <EmptyState
            icon={<Filter className="size-5" aria-hidden />}
            title="Nothing matches those filters"
            description="Loosen one of them — the universe is the most-traded names on each market, not every listed company."
            action={
              <Button size="sm" variant="secondary" onClick={() => setQuery(EMPTY)}>
                Reset filters
              </Button>
            }
          />
        </Card>
      )}

      <p className="text-xs text-content-subtle">
        The screener covers the most-traded names on each market rather than every listed company, because each row
        needs a fundamentals call. Companies listed on two exchanges appear once, under the more liquid listing.
      </p>
    </div>
  );
}
