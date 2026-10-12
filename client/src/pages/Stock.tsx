import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import { Button, ButtonLink, Card, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { PriceChart, RangeTabs } from '@/components/market';
import { AboutCompany, FinancialTrend, PriceRangeBar, RatioGrid, StockHeader, StatRow } from '@/components/stock';
import { AnalysisReport, AnalysisReportSkeleton } from '@/components/ai';
import { ArticleCard } from '@/components/news';
import { useStockDetail } from '@/hooks/useMarketData';
import { useAiStatus, useStockAnalysis } from '@/hooks/useAiAnalysis';
import { useSymbolNews } from '@/hooks/useNews';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseSecurityKey, type CandleRange } from '@/types';
import {
  changeTone,
  formatCurrency,
  formatMarketCap,
  formatMultiple,
  formatNumber,
  formatRate,
  formatVolume,
} from '@/utils/format';

export default function StockPage() {
  const { exchange = '', symbol = '' } = useParams();
  const [range, setRange] = useState<CandleRange>('1M');

  const [reportRequested, setReportRequested] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const security = parseSecurityKey(`${exchange.toUpperCase()}:${symbol.toUpperCase()}`);
  const detail = useStockDetail(security, range);

  const news = useSymbolNews(security, 4);
  const aiStatus = useAiStatus();
  const autoLoadReport = aiStatus.data ? !aiStatus.data.configured : false;
  const analysis = useStockAnalysis(security, autoLoadReport || reportRequested);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await analysis.regenerate();
    } finally {
      setRegenerating(false);
    }
  };

  const quote = detail.data?.quote;
  const profile = detail.data?.profile;
  const fundamentals = detail.data?.fundamentals;
  const currency = quote?.currency ?? 'USD';
  // The quote is freshest, then the exchange's own reported figure; a provider profile is the
  // last resort because its capitalisation is often stale against today's price.
  const marketCap = quote?.marketCap ?? fundamentals?.marketCap ?? profile?.marketCap ?? null;

  useDocumentTitle(
    security ? `${security.symbol} share price` : 'Stock not found',
    profile?.description ?? undefined,
  );

  if (!security) {
    return (
      <div className="container py-20">
        <EmptyState
          icon={<Search className="size-5" aria-hidden />}
          title="That listing does not exist"
          description={`Plumbline covers NSE, BSE, NASDAQ, NYSE and AMEX. "${exchange}" is not one of them.`}
          action={
            <ButtonLink to="/search" variant="secondary" size="sm">
              Search stocks
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <div className="container py-20">
        <QueryError error={detail.error} onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const stats = [
    { label: 'Open', value: formatCurrency(quote?.open, currency) },
    { label: 'Previous close', value: formatCurrency(quote?.previousClose, currency) },
    { label: 'Volume', value: formatVolume(quote?.volume) },
    { label: 'Market cap', value: formatMarketCap(marketCap, currency) },
    { label: 'P/E', value: formatMultiple(fundamentals?.valuation.peRatio) },
    { label: 'EPS', value: formatNumber(fundamentals?.perShare.eps) },
    { label: 'Dividend yield', value: formatRate(fundamentals?.dividend.yield) },
    { label: 'Beta', value: formatNumber(fundamentals?.risk.beta) },
  ];

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <Link
        to="/search"
        className="inline-flex items-center gap-1.5 text-sm text-content-muted transition-colors hover:text-content"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to search
      </Link>

      <StockHeader
        symbol={security.symbol}
        quote={quote}
        profile={profile}
        session={detail.data?.session}
        loading={detail.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card className="p-5 sm:p-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Price history</h2>
              <RangeTabs value={range} onChange={setRange} />
            </div>
            <PriceChart
              candles={detail.data?.candles?.candles ?? []}
              currency={currency}
              range={range}
              tone={changeTone(quote?.changePercent)}
              loading={detail.isPending}
              height={300}
            />
          </Card>

          <RatioGrid fundamentals={fundamentals} currency={currency} loading={detail.isPending} />

          <FinancialTrend annual={fundamentals?.annual} currency={currency} loading={detail.isPending} />
        </div>

        <div className="space-y-6 lg:col-span-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-base font-semibold">Key statistics</h2>

            <dl className="divide-y divide-hairline">
              {stats.map((stat) => (
                <StatRow key={stat.label} label={stat.label} value={stat.value} loading={detail.isPending} />
              ))}
            </dl>

            <div className="mt-5 space-y-5 border-t border-hairline pt-5">
              {detail.isPending ? (
                <Skeleton className="h-16" />
              ) : quote ? (
                <>
                  <PriceRangeBar
                    label="Day range"
                    low={quote.low}
                    high={quote.high}
                    current={quote.price}
                    currency={currency}
                  />
                  <PriceRangeBar
                    label="52 week range"
                    low={quote.week52Low}
                    high={quote.week52High}
                    current={quote.price}
                    currency={currency}
                  />
                </>
              ) : null}
            </div>

            {fundamentals?.fiscalPeriod ? (
              <p className="mt-5 text-xs text-content-subtle">
                Fundamentals as of {fundamentals.fiscalPeriod}.
              </p>
            ) : null}
          </Card>

          <AboutCompany profile={profile} loading={detail.isPending} />
        </div>
      </div>

      <section aria-label="Latest news">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Latest news</h2>
            <Link
              to={`/news?market=${security.exchange === 'NSE' || security.exchange === 'BSE' ? 'IN' : 'US'}`}
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              All market news
            </Link>
          </div>

          {news.isPending ? (
            <div className="grid gap-2 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          ) : news.data?.articles.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {news.data.articles.map((article) => (
                <ArticleCard key={article.id} article={article} compact />
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-subtle">No recent headlines found for this company.</p>
          )}
        </Card>
      </section>

      <section aria-label="Research report">
        {analysis.data ? (
          <AnalysisReport analysis={analysis.data} refreshing={regenerating} onRefresh={regenerate} />
        ) : analysis.isPending && (autoLoadReport || reportRequested) ? (
          <AnalysisReportSkeleton />
        ) : analysis.isError ? (
          <QueryError error={analysis.error} onRetry={() => analysis.refetch()} />
        ) : (
          <Card className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-600/10 text-brand-600 dark:text-brand-400">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="max-w-lg space-y-1.5">
              <h3 className="text-lg font-semibold">Generate the AI research report</h3>
              <p className="text-sm text-content-muted">
                {aiStatus.data?.note ??
                  'A full write-up on the business, its strengths and weaknesses, financial health, valuation, risks and outlook.'}
              </p>
            </div>
            <Button onClick={() => setReportRequested(true)} icon={<Sparkles className="size-4" aria-hidden />}>
              Generate report
            </Button>
            <p className="text-xs text-content-subtle">
              Reports are cached for 24 hours, so opening this page again will not re-run the model.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
