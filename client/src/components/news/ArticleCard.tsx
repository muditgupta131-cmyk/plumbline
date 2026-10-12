import { ExternalLink } from 'lucide-react';
import type { NewsArticle } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { SentimentChip } from './SentimentChip';

interface ArticleCardProps {
  article: NewsArticle;
  compact?: boolean;
}

export function ArticleCard({ article, compact }: ArticleCardProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'group flex flex-col gap-2 rounded-xl border border-hairline p-4 transition-colors hover:border-brand-500/40 hover:bg-content/[0.02]',
        compact && 'p-3',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className={cn(
            'font-medium leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {article.headline}
        </h3>
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-content-subtle" aria-hidden />
      </div>

      {article.summary && !compact ? (
        <p className="line-clamp-2 text-sm text-content-muted">{article.summary}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-content-subtle">
        <SentimentChip sentiment={article.sentiment} keywordBased={article.sentimentEngine === 'keyword'} />
        {article.source ? <span>{article.source}</span> : null}
        {article.publishedAt ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatRelativeTime(article.publishedAt)}</span>
          </>
        ) : null}
      </div>
    </a>
  );
}
