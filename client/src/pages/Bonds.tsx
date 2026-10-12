import { useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, Input, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { useBonds } from '@/hooks/useBonds';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { BondQuery, BondRow, BondSort } from '@/types';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

const MATURITY_BANDS: Array<{ value: NonNullable<BondQuery['maturity']> | ''; label: string }> = [
  { value: '', label: 'Any maturity' },
  { value: 'under1', label: 'Under 1 year' },
  { value: '1to3', label: '1 to 3 years' },
  { value: '3to5', label: '3 to 5 years' },
  { value: '5to10', label: '5 to 10 years' },
  { value: 'over10', label: 'Over 10 years' },
];

const COLUMNS: Array<{ field: BondSort; label: string; render: (row: BondRow) => string }> = [
  { field: 'couponRate', label: 'Coupon', render: (row) => formatPercent(row.couponRate) },
  { field: 'yearsToMaturity', label: 'Maturity', render: (row) => (row.yearsToMaturity === null ? '—' : `${row.yearsToMaturity}y`) },
  { field: 'currentYield', label: 'Current yield', render: (row) => formatPercent(row.currentYield) },
  { field: 'yieldToMaturity', label: 'YTM', render: (row) => formatPercent(row.yieldToMaturity) },
];

// Corporate paper is where NSE publishes coupon, maturity and rating, so it leads.
const EMPTY: BondQuery = { segment: 'corporate', tradedOnly: true, sort: 'yieldToMaturity', dir: 'desc', page: 1, limit: 25 };

export default function BondsPage() {
  useDocumentTitle('Bonds');
  const [query, setQuery] = useState<BondQuery>(EMPTY);
  const result = useBonds(query);

  const patch = (next: Partial<BondQuery>) => setQuery((current) => ({ ...current, page: 1, ...next }));
  const sortBy = (field: BondSort) =>
    setQuery((current) => ({
      ...current,
      sort: field,
      dir: current.sort === field && current.dir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));

  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const isGsec = query.segment === 'gsec';

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-content-subtle">Debt market</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bonds on the exchange</h1>
        <p className="max-w-2xl text-sm text-content-muted">
          Corporate debt and government securities traded on NSE, with the redemption yield worked out here —
          the exchange publishes a yield column but leaves it at zero on every row.
        </p>
      </header>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'corporate' as const, label: `Corporate${data ? ` (${data.counts.corporate.toLocaleString('en-IN')})` : ''}` },
              { id: 'gsec' as const, label: `Government${data ? ` (${data.counts.gsec.toLocaleString('en-IN')})` : ''}` },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => patch({ segment: tab.id, rating: undefined })}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                query.segment === tab.id ? 'bg-brand-600 text-white' : 'bg-content/[0.06] text-content-muted hover:text-content',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Search</span>
            <Input placeholder="Symbol or ISIN…" value={query.q ?? ''} onChange={(event) => patch({ q: event.target.value })} />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Credit rating</span>
            <select
              disabled={isGsec}
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-content outline-none focus:border-brand-500 disabled:opacity-50"
              value={query.rating ?? ''}
              onChange={(event) => patch({ rating: event.target.value || undefined })}
            >
              <option value="">Any rating</option>
              {(data?.ratings ?? []).map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-content-muted">Time to maturity</span>
            <select
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-content outline-none focus:border-brand-500"
              value={query.maturity ?? ''}
              onChange={(event) => patch({ maturity: (event.target.value || undefined) as BondQuery['maturity'] })}
            >
              {MATURITY_BANDS.map((band) => (
                <option key={band.value} value={band.value}>
                  {band.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={query.tradedOnly ?? false}
              onChange={(event) => patch({ tradedOnly: event.target.checked || undefined })}
            />
            <span className="text-sm text-content-muted">Traded today only</span>
          </label>
        </div>

        <Button size="sm" variant="ghost" onClick={() => setQuery(EMPTY)}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </Button>
      </Card>

      {result.isError ? <QueryError error={result.error} onRetry={() => void result.refetch()} /> : null}

      {isGsec ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          NSE does not publish a coupon or maturity date for government securities, so yields cannot be worked
          out for them here. Price and issuer are live; the yield columns stay empty rather than guess.
        </p>
      ) : null}

      {result.isPending ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </Card>
      ) : data && data.bonds.length ? (
        <Card className="overflow-hidden">
          <p className="border-b border-hairline px-4 py-2.5 text-xs text-content-subtle">
            {data.total.toLocaleString('en-IN')} bonds match · {data.counts.tradedToday} of{' '}
            {(data.counts.corporate + data.counts.gsec).toLocaleString('en-IN')} traded today · page {data.page} of {pages}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-content-subtle">
                    Bond
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-content-subtle">
                    Price
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
                          query.dir === 'desc' ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-hairline">
                {data.bonds.map((bond) => (
                  <tr key={`${bond.segment}:${bond.symbol}:${bond.isin ?? ''}`} className="transition-colors hover:bg-content/[0.02]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span data-numeric className="font-medium text-content">{bond.symbol}</span>
                        {bond.ratingGrade ? <Badge tone="accent">{bond.ratingGrade}</Badge> : null}
                      </span>
                      <span className="block text-xs text-content-subtle">
                        {bond.isin ?? '—'}
                        {bond.ratingAgency ? ` · ${bond.ratingAgency}` : ''}
                      </span>
                    </td>
                    <td data-numeric className="px-4 py-3 text-right">
                      {bond.price === null ? '—' : bond.price.toLocaleString('en-IN')}
                      <span className="block text-xs text-content-subtle">
                        {bond.tradedToday ? `${bond.volume?.toLocaleString('en-IN')} traded` : 'last close'}
                      </span>
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.field} data-numeric className="px-4 py-3 text-right">
                        {column.render(bond)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
            <Button size="sm" variant="ghost" disabled={data.page <= 1} onClick={() => setQuery((c) => ({ ...c, page: (c.page ?? 1) - 1 }))}>
              Previous
            </Button>
            <span className="text-xs text-content-subtle">
              Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}
            </span>
            <Button size="sm" variant="ghost" disabled={data.page >= pages} onClick={() => setQuery((c) => ({ ...c, page: (c.page ?? 1) + 1 }))}>
              Next
            </Button>
          </div>

          <p className="border-t border-hairline px-4 py-2.5 text-xs text-content-subtle">
            YTM assumes annual coupons, since NSE does not publish the payment frequency, and is left blank
            inside a year to maturity — there, the accrued interest a buyer also pays would distort it beyond use.
            A price marked &ldquo;last close&rdquo; is carried forward from an earlier session, not a live quote.
          </p>
        </Card>
      ) : (
        <EmptyState title="No bonds match" description="Widen the filters, or clear &ldquo;traded today only&rdquo;." />
      )}
    </div>
  );
}
