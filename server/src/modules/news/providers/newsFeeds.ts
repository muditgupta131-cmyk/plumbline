import { createHash } from 'node:crypto';
import { ApiError } from '../../../utils/ApiError.js';
import type { Exchange, Market } from '../../../types/market.js';
import { parseRss, type RssItem } from '../rss.js';
import { scoreSentiment } from '../sentiment.js';
import type { NewsArticle } from '../news.types.js';

const TIMEOUT_MS = 12_000;

const LOCALE: Record<Market, { hl: string; gl: string; ceid: string }> = {
  IN: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  US: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
};

const MARKET_QUERY: Record<Market, string> = {
  IN: 'Nifty Sensex Indian stock market',
  US: 'US stock market S&P 500 Nasdaq',
};

async function fetchXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/rss+xml, application/xml, text/xml', 'user-agent': 'Mozilla/5.0 (Plumbline)' },
    });
    if (!response.ok) throw ApiError.upstream(`News feed responded ${response.status}`);
    return await response.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw ApiError.upstream('The news feed timed out.');
    throw ApiError.upstream('Could not reach the news feed.');
  } finally {
    clearTimeout(timer);
  }
}

// Google appends " - Publisher" to headlines; the publisher is already a separate field.
function cleanHeadline(title: string, source: string | null): string {
  if (!source) return title;
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

// Google's description is often the headline repeated with the publisher appended.
function summaryFor(headline: string, description: string | null): string | null {
  if (!description) return null;

  const cleaned = description.replace(/\s+/g, ' ').trim();
  if (cleaned.toLowerCase().startsWith(headline.toLowerCase().slice(0, 40))) return null;

  return cleaned.slice(0, 400);
}

function toArticle(item: RssItem, context: { symbol: string | null; exchange: Exchange | null }): NewsArticle {
  const headline = cleanHeadline(item.title, item.source);
  const { sentiment, score } = scoreSentiment(headline, item.description ?? '');

  return {
    id: createHash('sha1').update(item.link).digest('hex').slice(0, 16),
    headline,
    summary: summaryFor(headline, item.description),
    url: item.link,
    source: item.source,
    publishedAt: item.publishedAt,
    sentiment,
    sentimentScore: score,
    sentimentEngine: 'keyword',
    symbol: context.symbol,
    exchange: context.exchange,
  };
}

function googleUrl(query: string, market: Market): string {
  const locale = LOCALE[market];
  const params = new URLSearchParams({ q: query, hl: locale.hl, gl: locale.gl, ceid: locale.ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function sortAndTrim(articles: NewsArticle[], limit: number): NewsArticle[] {
  const seen = new Set<string>();

  return articles
    .filter((article) => {
      const key = article.headline.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime())
    .slice(0, limit);
}

export async function fetchMarketNews(market: Market, limit: number): Promise<NewsArticle[]> {
  const xml = await fetchXml(googleUrl(MARKET_QUERY[market], market));
  const items = parseRss(xml);
  if (!items.length) throw ApiError.upstream('The news feed returned nothing.');

  return sortAndTrim(
    items.map((item) => toArticle(item, { symbol: null, exchange: null })),
    limit,
  );
}

export async function fetchSymbolNews(
  company: string,
  symbol: string,
  exchange: Exchange,
  market: Market,
  limit: number,
): Promise<NewsArticle[]> {
  const query = `${company} ${market === 'IN' ? 'share price' : 'stock'}`;
  const xml = await fetchXml(googleUrl(query, market));
  const items = parseRss(xml);

  return sortAndTrim(
    items.map((item) => toArticle(item, { symbol, exchange })),
    limit,
  );
}
