import { env } from '../../../config/env.js';
import { currencyForExchange, EXCHANGE_MARKET, type Market, type SecurityRef } from '../../../types/market.js';
import { INDEX_DEFINITIONS } from '../../../data/indices.seed.js';
import {
  type CandleRange,
  type CandleSeries,
  type IndexQuote,
  type MarketProvider,
  type Quote,
  type SymbolMatch,
} from './provider.types.js';
import { fetchJson, toIsoDate, UpstreamError } from './upstream.js';
import { fromYahooSymbol, normaliseExchange, toYahooSymbol } from './symbolMapping.js';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const BATCH_CONCURRENCY = 6;
const SEARCH_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';

interface ChartMeta {
  symbol?: string;
  currency?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketTime?: number;
  longName?: string;
  shortName?: string;
  exchangeName?: string;
}

interface ChartResponse {
  chart?: {
    error?: { code?: string; description?: string } | null;
    result?: Array<{
      meta?: ChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }>;
      };
    }>;
  };
}

interface SearchResponse {
  quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }>;
}

const RANGE_PARAMS: Record<CandleRange, { interval: string; range: string }> = {
  '1D': { interval: '5m', range: '1d' },
  '1W': { interval: '60m', range: '5d' },
  '1M': { interval: '1d', range: '1mo' },
  '6M': { interval: '1d', range: '6mo' },
  '1Y': { interval: '1d', range: '1y' },
  '5Y': { interval: '1wk', range: '5y' },
};

async function chart(symbol: string, interval: string, range: string): Promise<ChartResponse['chart']> {
  const payload = await fetchJson<ChartResponse>(`${CHART_BASE}/${encodeURIComponent(symbol)}`, {
    provider: 'yahoo',
    params: { interval, range },
  });

  if (payload.chart?.error) {
    throw new UpstreamError('yahoo', payload.chart.error.description ?? `Yahoo has no data for ${symbol}`, 404);
  }

  return payload.chart;
}

export const yahooProvider: MarketProvider = {
  id: 'yahoo',
  label: 'Yahoo Finance',
  capabilities: ['search', 'quote', 'quotes', 'candles', 'indices'],
  // Keyless and unmetered, so it sits last in the chain before sample data.
  isConfigured: () => env.YAHOO_ENABLED,

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const payload = await fetchJson<SearchResponse>(SEARCH_BASE, {
      provider: 'yahoo',
      params: { q: query, quotesCount: Math.min(limit * 2, 20), newsCount: 0 },
    });

    return (payload.quotes ?? [])
      .filter((item) => item.symbol && (item.quoteType === 'EQUITY' || item.quoteType === 'ETF'))
      .flatMap((item) => {
        const exchange = normaliseExchange(item.exchange) ?? fromYahooSymbol(item.symbol!, 'NASDAQ').exchange;
        const ref = fromYahooSymbol(item.symbol!, exchange);

        return [
          {
            symbol: ref.symbol,
            exchange: ref.exchange,
            name: item.longname ?? item.shortname ?? ref.symbol,
            market: EXCHANGE_MARKET[ref.exchange],
            currency: currencyForExchange(ref.exchange),
          },
        ];
      })
      .slice(0, limit);
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    const symbol = toYahooSymbol(ref);
    const result = (await chart(symbol, '1d', '5d'))?.result?.[0];
    const meta = result?.meta;

    if (!meta?.regularMarketPrice) throw new UpstreamError('yahoo', `Yahoo has no quote for ${symbol}`, 404);

    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = previousClose === null ? 0 : meta.regularMarketPrice - previousClose;

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      price: meta.regularMarketPrice,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : 0,
      open: null,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      previousClose,
      volume: meta.regularMarketVolume ?? null,
      marketCap: null,
      week52High: meta.fiftyTwoWeekHigh ?? null,
      week52Low: meta.fiftyTwoWeekLow ?? null,
      asOf: meta.regularMarketTime ? toIsoDate(meta.regularMarketTime) : new Date().toISOString(),
    };
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    const symbol = toYahooSymbol(ref);
    const { interval, range: window } = RANGE_PARAMS[range];
    const result = (await chart(symbol, interval, window))?.result?.[0];

    const stamps = result?.timestamp ?? [];
    const series = result?.indicators?.quote?.[0];

    if (!stamps.length || !series?.close) {
      throw new UpstreamError('yahoo', `Yahoo has no candles for ${symbol}`, 404);
    }

    const candles = stamps.flatMap((stamp, index) => {
      const close = series.close?.[index];
      if (close === null || close === undefined) return [];

      return [
        {
          t: toIsoDate(stamp),
          o: series.open?.[index] ?? close,
          h: series.high?.[index] ?? close,
          l: series.low?.[index] ?? close,
          c: close,
          v: series.volume?.[index] ?? 0,
        },
      ];
    });

    if (!candles.length) throw new UpstreamError('yahoo', `Yahoo returned an empty series for ${symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      range,
      interval,
      candles,
    };
  },

  // Yahoo has no multi-symbol endpoint worth trusting, but keeping a batch implementation here
  // means a market it can serve is not dropped just because the batch provider ahead of it cannot.
  async quotes(refs: SecurityRef[]): Promise<Quote[]> {
    const results: Quote[] = [];

    for (let index = 0; index < refs.length; index += BATCH_CONCURRENCY) {
      const slice = refs.slice(index, index + BATCH_CONCURRENCY);
      const settled = await Promise.allSettled(slice.map((ref) => yahooProvider.quote!(ref)));

      for (const entry of settled) {
        if (entry.status === 'fulfilled') results.push(entry.value);
      }
    }

    if (!results.length) throw new UpstreamError('yahoo', 'Yahoo priced none of the requested symbols', 404);

    return results;
  },

  async indices(market?: Market): Promise<IndexQuote[]> {
    const definitions = INDEX_DEFINITIONS.filter((definition) => !market || definition.market === market);

    const settled = await Promise.allSettled(
      definitions.map(async (definition) => {
        const result = await chart(definition.providerSymbol, '1d', '5d');
        const entry = result?.result?.[0];
        const meta = entry?.meta;
        const value = meta?.regularMarketPrice;

        if (!value) throw new UpstreamError('yahoo', `Yahoo has no quote for ${definition.providerSymbol}`, 404);

        // The index chart meta carries no opening price, so take it from the latest session bar.
        const opens = entry?.indicators?.quote?.[0]?.open ?? [];
        const sessionOpen = [...opens].reverse().find((price) => typeof price === 'number' && price > 0) ?? null;

        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? value;
        const change = value - previousClose;

        return {
          id: definition.id,
          name: definition.name,
          short: definition.short,
          market: definition.market,
          currency: definition.currency,
          value,
          change,
          changePercent: previousClose ? (change / previousClose) * 100 : 0,
          open: meta.regularMarketOpen ?? sessionOpen,
          high: meta.regularMarketDayHigh ?? null,
          low: meta.regularMarketDayLow ?? null,
          previousClose,
          asOf: meta.regularMarketTime ? toIsoDate(meta.regularMarketTime) : new Date().toISOString(),
        } satisfies IndexQuote;
      }),
    );

    const quotes = settled.flatMap((entry) => (entry.status === 'fulfilled' ? [entry.value] : []));
    if (!quotes.length) throw new UpstreamError('yahoo', 'Yahoo returned no index quotes', 404);

    return quotes;
  },
};
