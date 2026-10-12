import type { Exchange, Market } from '../../types/market.js';

export const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export type SentimentEngine = 'openai' | 'keyword';

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string | null;
  url: string;
  source: string | null;
  publishedAt: string | null;
  sentiment: Sentiment;
  sentimentScore: number;
  sentimentEngine: SentimentEngine;
  symbol: string | null;
  exchange: Exchange | null;
}

export interface NewsFeed {
  market: Market | 'ALL';
  symbol: string | null;
  articles: NewsArticle[];
  provider: string;
  fetchedAt: string;
  /** True when the upstream feed answered but carried nothing, so this is not a real "no news" result. */
  degraded?: boolean;
}

export interface MarketDigest {
  market: Market;
  summary: string;
  drivers: string[];
  tone: Sentiment;
  articleCount: number;
  breakdown: Record<Sentiment, number>;
  engine: SentimentEngine;
  generatedAt: string;
}
