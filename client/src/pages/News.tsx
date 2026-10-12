import { useSearchParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { ArticleCard, MarketDigestCard } from '@/components/news';
import { useMarketDigest, useMarketNews } from '@/hooks/useNews';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MARKETS, type Market } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const MARKET_LABELS: Record<Market, string> = { IN: 'India', US: 'United States' };

export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const market: Market = params.get('market') === 'US' ? 'US' : 'IN';

  const news = useMarketNews(market, 24);
  const digest = useMarketDigest(market);

  useDocumentTitle(
    'Market news',
    'Headlines across the Indian and US markets with sentiment scored on every story.',
  );

  const setMarket = (next: Market) => {
    const search = new URLSearchParams(params);
    search.set('market', next);
    setParams(search, { replace: true });
  };

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">News</p>
          <h1 className="text-display-md">Market news</h1>
          <p className="text-sm text-content-subtle">
            {news.data ? `${news.data.provider} · updated ${formatRelativeTime(news.data.fetchedAt)}` : 'Loading feed…'}
          </p>
        </div>

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
      </header>

      <MarketDigestCard digest={digest.data} loading={digest.isPending} />

      {news.isError ? (
        <QueryError error={news.error} onRetry={() => news.refetch()} />
      ) : news.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : news.data.articles.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {news.data.articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <Card className="p-10">
          <EmptyState
            icon={<Newspaper className="size-5" aria-hidden />}
            title={news.data?.degraded ? 'The news feed is throttling us' : 'No headlines right now'}
            description={
              news.data?.degraded
                ? 'Google answered without any headlines, which usually means too many requests in a short window. It clears on its own in a few minutes.'
                : 'The news feed returned nothing for this market. Try again in a few minutes.'
            }
          />
        </Card>
      )}

      <p className="text-xs text-content-subtle">
        Sentiment is scored from headline keywords, not a language model, and can misread irony or context. Stories
        open at their original publisher.
      </p>
    </div>
  );
}
