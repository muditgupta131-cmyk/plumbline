import { env } from '../../../config/env.js';
import { currencyForExchange, EXCHANGE_MARKET, type Currency, type SecurityRef } from '../../../types/market.js';
import {
  type CandleRange,
  type CandleSeries,
  type FxRate,
  type MarketProvider,
  type Quote,
  type SymbolMatch,
} from './provider.types.js';
import { fetchJson, toIsoDate, UpstreamError } from './upstream.js';
import { normaliseExchange } from './symbolMapping.js';

const BASE = 'https://api.twelvedata.com';

const EXCHANGE_PARAM: Record<string, string> = {
  NSE: 'NSE',
  BSE: 'BSE',
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  AMEX: 'NYSE American',
};

interface TwelveError {
  status?: string;
  message?: string;
  code?: number;
}

interface TwelveSearch extends TwelveError {
  data?: Array<{ symbol: string; instrument_name: string; exchange: string; instrument_type?: string; currency?: string }>;
}

interface TwelveQuote extends TwelveError {
  symbol?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
  timestamp?: number;
  fifty_two_week?: { low?: string; high?: string };
}

interface TwelveSeries extends TwelveError {
  values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
}

const SERIES_CONFIG: Record<CandleRange, { interval: string; outputsize: number }> = {
  '1D': { interval: '5min', outputsize: 78 },
  '1W': { interval: '1h', outputsize: 40 },
  '1M': { interval: '1day', outputsize: 22 },
  '6M': { interval: '1day', outputsize: 130 },
  '1Y': { interval: '1day', outputsize: 252 },
  '5Y': { interval: '1week', outputsize: 260 },
};

function apikey(): string {
  return env.TWELVE_DATA_API_KEY ?? '';
}

function assertOk<T extends TwelveError>(payload: T): T {
  if (payload.status === 'error') {
    throw new UpstreamError('twelvedata', payload.message ?? 'Twelve Data rejected the request', payload.code ?? 502);
  }
  return payload;
}

function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const twelveDataProvider: MarketProvider = {
  id: 'twelvedata',
  label: 'Twelve Data',
  capabilities: ['search', 'quote', 'candles', 'fx'],
  isConfigured: () => Boolean(env.TWELVE_DATA_API_KEY),

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const payload = assertOk(
      await fetchJson<TwelveSearch>(`${BASE}/symbol_search`, {
        provider: 'twelvedata',
        params: { symbol: query, outputsize: Math.min(limit * 3, 30) },
      }),
    );

    const matches: SymbolMatch[] = [];
    for (const item of payload.data ?? []) {
      const exchange = normaliseExchange(item.exchange);
      if (!exchange) continue;
      matches.push({
        symbol: item.symbol.toUpperCase(),
        exchange,
        name: item.instrument_name,
        market: EXCHANGE_MARKET[exchange],
        currency: currencyForExchange(exchange),
      });
      if (matches.length >= limit) break;
    }
    return matches;
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    const payload = assertOk(
      await fetchJson<TwelveQuote>(`${BASE}/quote`, {
        provider: 'twelvedata',
        params: {
          symbol: ref.symbol.toUpperCase(),
          exchange: EXCHANGE_PARAM[ref.exchange],
          apikey: apikey(),
        },
      }),
    );

    const price = num(payload.close);
    if (price === null) throw new UpstreamError('twelvedata', `Twelve Data has no quote for ${ref.symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      price,
      change: num(payload.change) ?? 0,
      changePercent: num(payload.percent_change) ?? 0,
      open: num(payload.open),
      high: num(payload.high),
      low: num(payload.low),
      previousClose: num(payload.previous_close),
      volume: num(payload.volume),
      marketCap: null,
      week52High: num(payload.fifty_two_week?.high),
      week52Low: num(payload.fifty_two_week?.low),
      asOf: payload.timestamp ? toIsoDate(payload.timestamp) : new Date().toISOString(),
    };
  },

  async fxRate(base: Currency, quote: Currency): Promise<FxRate> {
    if (base === quote) return { base, quote, rate: 1, asOf: new Date().toISOString() };

    const payload = assertOk(
      await fetchJson<TwelveError & { rate?: number; timestamp?: number }>(`${BASE}/exchange_rate`, {
        provider: 'twelvedata',
        params: { symbol: `${base}/${quote}`, apikey: apikey() },
      }),
    );

    if (!payload.rate) throw new UpstreamError('twelvedata', `Twelve Data has no rate for ${base}/${quote}`, 404);

    return {
      base,
      quote,
      rate: payload.rate,
      asOf: payload.timestamp ? toIsoDate(payload.timestamp) : new Date().toISOString(),
    };
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    const config = SERIES_CONFIG[range];
    const payload = assertOk(
      await fetchJson<TwelveSeries>(`${BASE}/time_series`, {
        provider: 'twelvedata',
        params: {
          symbol: ref.symbol.toUpperCase(),
          exchange: EXCHANGE_PARAM[ref.exchange],
          interval: config.interval,
          outputsize: config.outputsize,
          apikey: apikey(),
        },
      }),
    );

    if (!payload.values?.length) {
      throw new UpstreamError('twelvedata', `Twelve Data has no candles for ${ref.symbol}`, 404);
    }

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      range,
      interval: config.interval,
      candles: payload.values
        .map((row) => ({
          t: toIsoDate(row.datetime),
          o: num(row.open) ?? 0,
          h: num(row.high) ?? 0,
          l: num(row.low) ?? 0,
          c: num(row.close) ?? 0,
          v: num(row.volume) ?? 0,
        }))
        .reverse(),
    };
  },
};
