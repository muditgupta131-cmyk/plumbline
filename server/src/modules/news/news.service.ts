import { ApiError } from '../../utils/ApiError.js';
import { cached } from '../market/market.cache.js';
import { lookupSymbols } from '../market/symbol.service.js';
import { isOpenAiConfigured } from '../ai/openai.client.js';
import { securityKey, EXCHANGE_MARKET, type Exchange, type Market, type SecurityRef } from '../../types/market.js';
import { fetchMarketNews, fetchSymbolNews } from './providers/newsFeeds.js';
import type { MarketDigest, NewsArticle, NewsFeed, Sentiment } from './news.types.js';

const FEED_TTL = 10 * 60_000;
const DIGEST_TTL = 30 * 60_000;

/**
 * Google occasionally answers with a valid RSS envelope carrying no items — a throttle, not an
 * empty world. Throwing inside the loader keeps that out of the cache and lets the cache serve
 * the last good feed; only when there is nothing to fall back on do we return an empty feed,
 * because a momentary upstream blip should not break the page.
 */
export async function getMarketNews(market: Market, limit: number): Promise<NewsFeed> {
  try {
    return await cached(`news:market:${market}:${limit}`, FEED_TTL, async () => {
      const articles = await fetchMarketNews(market, limit);
      if (!articles.length) throw ApiError.upstream('The news feed answered with no headlines.');

      return {
        market,
        symbol: null,
        articles,
        provider: 'Google News',
        fetchedAt: new Date().toISOString(),
      };
    });
  } catch {
    return {
      market,
      symbol: null,
      articles: [],
      provider: 'Google News',
      fetchedAt: new Date().toISOString(),
      degraded: true,
    };
  }
}

export async function getSymbolNews(ref: SecurityRef, limit: number): Promise<NewsFeed> {
  return cached(`news:symbol:${securityKey(ref)}:${limit}`, FEED_TTL, async () => {
    const metadata = await lookupSymbols([ref]);
    const company = metadata.get(securityKey(ref))?.name ?? ref.symbol;
    const market = EXCHANGE_MARKET[ref.exchange];

    return {
      market,
      symbol: ref.symbol,
      articles: await fetchSymbolNews(company, ref.symbol, ref.exchange, market, limit),
      provider: 'Google News',
      fetchedAt: new Date().toISOString(),
    };
  });
}

function tally(articles: NewsArticle[]): Record<Sentiment, number> {
  return articles.reduce(
    (totals, article) => ({ ...totals, [article.sentiment]: totals[article.sentiment] + 1 }),
    { positive: 0, neutral: 0, negative: 0 } as Record<Sentiment, number>,
  );
}

function buildKeywordDigest(market: Market, articles: NewsArticle[]): MarketDigest {
  const breakdown = tally(articles);
  const decisive = breakdown.positive + breakdown.negative;
  const lean = breakdown.positive - breakdown.negative;

  const tone: Sentiment = decisive === 0 ? 'neutral' : lean > 1 ? 'positive' : lean < -1 ? 'negative' : 'neutral';
  const label = market === 'IN' ? 'Indian market' : 'US market';

  const summary =
    decisive === 0
      ? `Across ${articles.length} ${label} headlines, none carried a clear directional signal. Keyword scoring reads the flow as balanced.`
      : `Of ${articles.length} ${label} headlines, ${breakdown.positive} read positive and ${breakdown.negative} negative. ` +
        `The balance leans ${tone === 'neutral' ? 'neither way' : tone}.`;

  return {
    market,
    summary,
    drivers: articles
      .filter((article) => article.sentiment !== 'neutral')
      .slice(0, 5)
      .map((article) => article.headline),
    tone,
    articleCount: articles.length,
    breakdown,
    engine: 'keyword',
    generatedAt: new Date().toISOString(),
  };
}

export async function getMarketDigest(market: Market): Promise<MarketDigest> {
  const feed = await getMarketNews(market, 20);

  // Never cache a digest built on a throttled feed, or it sticks around for half an hour.
  if (!feed.articles.length) return buildKeywordDigest(market, []);

  return cached(`news:digest:${market}`, DIGEST_TTL, async () => buildKeywordDigest(market, feed.articles));
}

export function newsStatus(): { provider: string; aiSummaries: boolean; note: string } {
  return {
    provider: 'Google News RSS',
    aiSummaries: isOpenAiConfigured(),
    note: isOpenAiConfigured()
      ? 'Headlines are scored by keyword; AI summaries are available for individual reports.'
      : 'Sentiment is keyword-based, not a language model. Set OPENAI_API_KEY for written summaries.',
  };
}

export type { Exchange };
