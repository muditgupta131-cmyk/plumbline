import { useState } from 'react';
import { ArrowRight, Building2, ExternalLink, MapPin, UserRound } from 'lucide-react';
import { Badge, ButtonLink, Card, Delta, Skeleton, SkeletonText } from '@/components/ui';
import { QueryError } from '@/components/feedback';
import { useCandles, useQuote } from '@/hooks/useMarketData';
import { marketService } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { securityKey, type CandleRange, type SecurityRef, type SymbolMatch } from '@/types';
import { changeTone, formatCurrency, formatMarketCap, formatRange, formatRelativeTime, formatVolume } from '@/utils/format';
import { DataSourceBadge } from './DataSourceBadge';
import { ExchangePill } from './ExchangePill';
import { PriceChart } from './PriceChart';
import { RangeTabs } from './RangeTabs';
import { SymbolLogo } from './SymbolLogo';

interface QuotePanelProps {
  security: SecurityRef;
  match?: SymbolMatch;
}

export function QuotePanel({ security, match }: QuotePanelProps) {
  const [range, setRange] = useState<CandleRange>('1M');

  const quote = useQuote(security, { refetchIntervalMs: 30_000 });
  const candles = useCandles(security, range);
  const profile = useQuery({
    queryKey: queryKeys.profile(securityKey(security)),
    queryFn: () => marketService.profile(security),
    staleTime: 60 * 60_000,
  });

  const currency = quote.data?.currency ?? match?.currency ?? 'USD';
  const tone = changeTone(quote.data?.changePercent);
  const name = quote.data ? (profile.data?.name ?? match?.name ?? security.symbol) : (match?.name ?? security.symbol);

  const stats = [
    { label: 'Open', value: formatCurrency(quote.data?.open, currency) },
    { label: 'Previous close', value: formatCurrency(quote.data?.previousClose, currency) },
    { label: 'Day range', value: formatRange(quote.data?.low, quote.data?.high, currency) },
    { label: '52 week range', value: formatRange(quote.data?.week52Low, quote.data?.week52High, currency) },
    { label: 'Volume', value: formatVolume(quote.data?.volume) },
    { label: 'Market cap', value: formatMarketCap(quote.data?.marketCap ?? profile.data?.marketCap, currency) },
  ];

  if (quote.isError) {
    return (
      <Card className="p-6">
        <QueryError error={quote.error} onRetry={() => quote.refetch()} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <SymbolLogo symbol={security.symbol} name={name} logoUrl={profile.data?.logoUrl ?? match?.logoUrl} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{name}</h2>
              <ExchangePill exchange={security.exchange} />
            </div>
            <p data-numeric className="text-sm text-content-muted">
              {security.symbol}
            </p>
          </div>
        </div>
        <DataSourceBadge source={quote.data?.source} />
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-5 sm:px-6">
        {quote.isPending ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <>
            <p data-numeric className="text-display-md leading-none">
              {formatCurrency(quote.data.price, currency)}
            </p>
            <Delta value={quote.data.changePercent} absolute={quote.data.change} size="md" />
            <span className="text-xs text-content-subtle">
              Updated {formatRelativeTime(quote.data.asOf)}
            </span>
          </>
        )}
      </div>

      <div className="mt-5 px-5 sm:px-6">
        <RangeTabs value={range} onChange={setRange} className="mb-2 justify-end" />
        <PriceChart
          candles={candles.data?.candles ?? []}
          currency={currency}
          range={range}
          tone={tone}
          loading={candles.isPending}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px border-t border-hairline bg-hairline sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-3.5">
            <dt className="text-[11px] uppercase tracking-wide text-content-subtle">{stat.label}</dt>
            <dd data-numeric className="mt-1 truncate text-sm font-medium">
              {quote.isPending ? <Skeleton rounded="sm" className="h-4 w-20" /> : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-hairline p-5 sm:p-6">
        <ButtonLink
          to={`/stocks/${security.exchange}/${encodeURIComponent(security.symbol)}`}
          fullWidth
          icon={<ArrowRight className="size-4" aria-hidden />}
        >
          Open full analysis
        </ButtonLink>
      </div>

      <div className="space-y-3 border-t border-hairline p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {(profile.data?.sector ?? match?.sector) ? <Badge tone="brand">{profile.data?.sector ?? match?.sector}</Badge> : null}
          {(profile.data?.industry ?? match?.industry) ? (
            <Badge>{profile.data?.industry ?? match?.industry}</Badge>
          ) : null}
        </div>

        {profile.isPending ? (
          <SkeletonText lines={3} />
        ) : profile.isError ? (
          <p className="text-sm text-content-subtle">Company profile is unavailable for this symbol right now.</p>
        ) : (
          <p className="line-clamp-4 text-sm leading-relaxed text-content-muted">{profile.data.description}</p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-content-subtle">
          {profile.data?.ceo ? (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden />
              {profile.data.ceo}
            </span>
          ) : null}
          {profile.data?.headquarters ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {profile.data.headquarters}
            </span>
          ) : null}
          {profile.data?.employees ? (
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden />
              {new Intl.NumberFormat('en-US').format(profile.data.employees)} employees
            </span>
          ) : null}
          {profile.data?.website ? (
            <a
              href={profile.data.website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-accent-600 hover:underline dark:text-accent-400"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Website
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
