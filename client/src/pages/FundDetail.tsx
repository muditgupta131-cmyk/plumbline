import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { QueryError } from '@/components/feedback';
import { PriceChart } from '@/components/market';
import { useFundDetail, useFundHistory } from '@/hooks/useFunds';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCurrency, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

const RANGES = [
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
  { label: '3Y', days: 1095 },
  { label: '5Y', days: 1825 },
] as const;

export default function FundDetailPage() {
  const { schemeCode } = useParams<{ schemeCode: string }>();
  const [days, setDays] = useState<number>(365);

  const detail = useFundDetail(schemeCode);
  const history = useFundHistory(schemeCode, days);

  useDocumentTitle(detail.data ? detail.data.name : 'Fund');

  const fund = detail.data;
  const points = history.data?.points ?? [];
  // The chart component reads a close price; a scheme's NAV is the same idea.
  const candles = points.map((point) => ({ t: point.t, o: point.nav, h: point.nav, l: point.nav, c: point.nav, v: 0 }));
  const move = points.length > 1 ? points[points.length - 1].nav - points[0].nav : 0;

  return (
    <div className="container space-y-6 py-8">
      <Link to="/funds" className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content">
        <ArrowLeft className="size-4" aria-hidden /> All funds
      </Link>

      {detail.isError ? <QueryError error={detail.error} onRetry={() => void detail.refetch()} /> : null}

      {detail.isPending ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-56 w-full" />
        </Card>
      ) : fund ? (
        <>
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{fund.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-content-muted">
              <Badge tone="brand">{fund.fundHouse}</Badge>
              <Badge tone="accent">{fund.category}</Badge>
              {fund.plan ? <Badge>{fund.plan}</Badge> : null}
              {fund.option ? <Badge>{fund.option}</Badge> : null}
            </div>
            <p className="flex flex-wrap items-baseline gap-3">
              <span data-numeric className="text-3xl font-semibold">
                {formatCurrency(fund.nav, 'INR')}
              </span>
              <span className="text-xs text-content-subtle">
                NAV as at {new Date(fund.navDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                { label: '1 year', value: fund.return1y },
                { label: '3 years p.a.', value: fund.return3y },
                { label: '5 years p.a.', value: fund.return5y },
              ]
            ).map((item) => (
              <Card key={item.label} className="p-4">
                <p className="text-xs uppercase tracking-wide text-content-subtle">{item.label}</p>
                <p
                  data-numeric
                  className={cn(
                    'mt-1 text-xl font-semibold',
                    item.value === null ? 'text-content-subtle' : item.value >= 0 ? 'text-bull' : 'text-bear',
                  )}
                >
                  {formatPercent(item.value)}
                </p>
              </Card>
            ))}
          </div>

          {fund.categoryRank ? (
            <Card className="p-4">
              <p className="text-sm text-content">
                Ranked <strong>{fund.categoryRank}</strong> of {fund.categorySize} in {fund.category} on three-year
                return
                {fund.categoryMedian3y !== null ? (
                  <>
                    {' '}
                    — the middle fund in that category returned{' '}
                    <strong data-numeric>{formatPercent(fund.categoryMedian3y)}</strong> a year.
                  </>
                ) : (
                  '.'
                )}
              </p>
            </Card>
          ) : null}

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">NAV history</h2>
              <div className="flex gap-1.5">
                {RANGES.map((range) => (
                  <Button
                    key={range.label}
                    size="sm"
                    variant={days === range.days ? 'primary' : 'ghost'}
                    onClick={() => setDays(range.days)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            {history.isError ? (
              <QueryError error={history.error} onRetry={() => void history.refetch()} />
            ) : (
              <PriceChart
                candles={candles}
                currency="INR"
                range="1Y"
                tone={move > 0 ? 'up' : move < 0 ? 'down' : 'flat'}
                loading={history.isPending}
                height={260}
              />
            )}

            {!history.isPending && points.length === 0 ? (
              <p className="text-xs text-content-subtle">
                No NAV history is published for this scheme over that period.
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Scheme details</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ['ISIN', fund.isin ?? '—'],
                  ['AMFI scheme code', fund.schemeCode],
                  ['Fund house', fund.fundHouse],
                  ['Category', fund.category],
                  ['Plan', fund.plan ?? '—'],
                  ['Option', fund.option ?? '—'],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-hairline pb-2">
                  <dt className="text-content-muted">{label}</dt>
                  <dd data-numeric className="text-right text-content">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      ) : null}
    </div>
  );
}
