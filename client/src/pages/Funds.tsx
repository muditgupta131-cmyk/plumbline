import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { Button, Card, Input, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { useFundExplorer } from '@/hooks/useFunds';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { FundExploreQuery, FundRow, FundSort } from '@/types';
import { formatCurrency, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

const COLUMNS: Array<{ field: FundSort; label: string; render: (row: FundRow) => string }> = [
  { field: 'nav', label: 'NAV', render: (row) => formatCurrency(row.nav, 'INR') },
  { field: 'return1y', label: '1Y', render: (row) => formatPercent(row.return1y) },
  { field: 'return3y', label: '3Y p.a.', render: (row) => formatPercent(row.return3y) },
  { field: 'return5y', label: '5Y p.a.', render: (row) => formatPercent(row.return5y) },
];

const EMPTY: FundExploreQuery = { sort: 'return3y', dir: 'desc', page: 1, limit: 25 };

export default function FundsPage() {
  useDocumentTitle('Mutual funds');
  const [query, setQuery] = useState<FundExploreQuery>(EMPTY);
  const result = useFundExplorer(query);

  const patch = (next: Partial<FundExploreQuery>) => setQuery((current) => ({ ...current, page: 1, ...next }));

  const sortBy = (field: FundSort) =>
    setQuery((current) => ({
      ...current,
      sort: field,
      dir: current.sort === field && current.dir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));

  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-content-subtle">Mutual funds</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Every scheme AMFI publishes</h1>
        <p className="max-w-2xl text-sm text-content-muted">
          {data ? `${data.total.toLocaleString('en-IN')} schemes` : 'The whole universe'}, ranked on returns worked
          out from AMFI&rsquo;s own daily NAV history. Annualised figures are compound, not cumulative.
        </p>
      </header>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Search</span>
            <Input
              placeholder="Fund name…"
              value={query.q ?? ''}
              onChange={(event) => patch({ q: event.target.value })}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Category</span>
            <select
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-content outline-none focus:border-brand-500"
              value={query.category ?? ''}
              onChange={(event) => patch({ category: event.target.value || undefined })}
            >
              <option value="">Every category</option>
              {(data?.categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Fund house</span>
            <select
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-content outline-none focus:border-brand-500"
              value={query.fundHouse ?? ''}
              onChange={(event) => patch({ fundHouse: event.target.value || undefined })}
            >
              <option value="">Every fund house</option>
              {(data?.fundHouses ?? []).map((house) => (
                <option key={house} value={house}>
                  {house}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Plan</span>
            <select
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-content outline-none focus:border-brand-500"
              value={query.plan ?? ''}
              onChange={(event) => patch({ plan: (event.target.value || undefined) as FundExploreQuery['plan'] })}
            >
              <option value="">Direct and Regular</option>
              <option value="Direct">Direct only</option>
              <option value="Regular">Regular only</option>
            </select>
          </label>
        </div>

        <Button size="sm" variant="ghost" onClick={() => setQuery(EMPTY)}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </Button>
      </Card>

      {result.isError ? <QueryError error={result.error} onRetry={() => void result.refetch()} /> : null}

      {result.isPending ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </Card>
      ) : data && data.funds.length ? (
        <Card className="overflow-hidden">
          <p className="border-b border-hairline px-4 py-2.5 text-xs text-content-subtle">
            {data.total.toLocaleString('en-IN')} schemes match · page {data.page} of {pages}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-content-subtle"
                  >
                    Scheme
                  </th>
                  {COLUMNS.map((column) => (
                    <th key={column.field} scope="col" className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => sortBy(column.field)}
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition-colors',
                          query.sort === column.field ? 'text-content' : 'text-content-subtle hover:text-content',
                        )}
                      >
                        {column.label}
                        {query.sort === column.field ? (
                          query.dir === 'desc' ? (
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
                {data.funds.map((row) => (
                  <tr key={row.schemeCode} className="transition-colors hover:bg-content/[0.02]">
                    <td className="px-4 py-3">
                      <Link to={`/funds/${row.schemeCode}`} className="group block">
                        <span className="block font-medium text-content group-hover:text-brand-500">{row.name}</span>
                        <span className="block text-xs text-content-subtle">
                          {row.fundHouse} · {row.category}
                        </span>
                      </Link>
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.field} data-numeric className="px-4 py-3 text-right">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page <= 1}
              onClick={() => setQuery((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className="text-xs text-content-subtle">
              Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={data.page >= pages}
              onClick={() => setQuery((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>

          <p className="border-t border-hairline px-4 py-2.5 text-xs text-content-subtle">
            A dash means AMFI&rsquo;s historical NAV report does not cover that scheme far enough back — the fund
            may be younger than the period, or simply absent from that report.
          </p>
        </Card>
      ) : (
        <EmptyState title="No schemes match" description="Widen the filters, or clear the search box." />
      )}
    </div>
  );
}
