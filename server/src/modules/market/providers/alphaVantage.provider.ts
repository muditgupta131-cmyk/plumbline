import { env } from '../../../config/env.js';
import { currencyForExchange, EXCHANGE_MARKET, type SecurityRef } from '../../../types/market.js';
import {
  RANGE_WINDOW_DAYS,
  type CandleRange,
  type CandleSeries,
  type CompanyProfile,
  type Fundamentals,
  type MarketProvider,
  type Quote,
  type SymbolMatch,
} from './provider.types.js';
import { fetchJson, toIsoDate, UpstreamError } from './upstream.js';
import { fromYahooSymbol, toAlphaVantageSymbol } from './symbolMapping.js';

const BASE = 'https://www.alphavantage.co/query';

interface Throttled {
  Note?: string;
  Information?: string;
  'Error Message'?: string;
}

interface AlphaSearch extends Throttled {
  bestMatches?: Array<Record<string, string>>;
}

interface AlphaQuote extends Throttled {
  'Global Quote'?: Record<string, string>;
}

interface AlphaOverview extends Throttled {
  Symbol?: string;
  Name?: string;
  Description?: string;
  Sector?: string;
  Industry?: string;
  Address?: string;
  MarketCapitalization?: string;
  '52WeekHigh'?: string;
  '52WeekLow'?: string;
  Currency?: string;
}

type AlphaOverviewRecord = AlphaOverview & Record<string, string | undefined>;

interface AlphaSeries extends Throttled {
  'Time Series (Daily)'?: Record<string, Record<string, string>>;
}

function apikey(): string {
  return env.ALPHA_VANTAGE_API_KEY ?? '';
}

function assertOk<T extends Throttled>(payload: T): T {
  const message = payload.Note ?? payload.Information ?? payload['Error Message'];
  if (message) throw new UpstreamError('alphavantage', message, 429);
  return payload;
}

function num(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export const alphaVantageProvider: MarketProvider = {
  id: 'alphavantage',
  label: 'Alpha Vantage',
  capabilities: ['search', 'quote', 'profile', 'candles', 'fundamentals'],
  isConfigured: () => Boolean(env.ALPHA_VANTAGE_API_KEY),

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const payload = assertOk(
      await fetchJson<AlphaSearch>(BASE, {
        provider: 'alphavantage',
        params: { function: 'SYMBOL_SEARCH', keywords: query, apikey: apikey() },
      }),
    );

    return (payload.bestMatches ?? []).slice(0, limit).map((item) => {
      const ref = fromYahooSymbol(item['1. symbol'] ?? '', 'NASDAQ');
      return {
        symbol: ref.symbol,
        exchange: ref.exchange,
        name: item['2. name'] ?? ref.symbol,
        market: EXCHANGE_MARKET[ref.exchange],
        currency: currencyForExchange(ref.exchange),
      };
    });
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    const symbol = toAlphaVantageSymbol(ref);
    const payload = assertOk(
      await fetchJson<AlphaQuote>(BASE, {
        provider: 'alphavantage',
        params: { function: 'GLOBAL_QUOTE', symbol, apikey: apikey() },
      }),
    );

    const quote = payload['Global Quote'] ?? {};
    const price = num(quote['05. price']);
    if (price === null) throw new UpstreamError('alphavantage', `Alpha Vantage has no quote for ${symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      price,
      change: num(quote['09. change']) ?? 0,
      changePercent: num(quote['10. change percent']) ?? 0,
      open: num(quote['02. open']),
      high: num(quote['03. high']),
      low: num(quote['04. low']),
      previousClose: num(quote['08. previous close']),
      volume: num(quote['06. volume']),
      marketCap: null,
      week52High: null,
      week52Low: null,
      asOf: quote['07. latest trading day'] ? toIsoDate(quote['07. latest trading day']) : new Date().toISOString(),
    };
  },

  async profile(ref: SecurityRef): Promise<CompanyProfile> {
    const symbol = toAlphaVantageSymbol(ref);
    const payload = assertOk(
      await fetchJson<AlphaOverview>(BASE, {
        provider: 'alphavantage',
        params: { function: 'OVERVIEW', symbol, apikey: apikey() },
      }),
    );

    if (!payload.Name) throw new UpstreamError('alphavantage', `Alpha Vantage has no profile for ${symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      name: payload.Name,
      currency: currencyForExchange(ref.exchange),
      description: payload.Description ?? null,
      sector: payload.Sector ?? null,
      industry: payload.Industry ?? null,
      ceo: null,
      headquarters: payload.Address ?? null,
      website: null,
      employees: null,
      logoUrl: null,
      ipoDate: null,
      marketCap: num(payload.MarketCapitalization),
    };
  },

  async fundamentals(ref: SecurityRef): Promise<Fundamentals> {
    const symbol = toAlphaVantageSymbol(ref);
    const payload = assertOk(
      await fetchJson<AlphaOverviewRecord>(BASE, {
        provider: 'alphavantage',
        params: { function: 'OVERVIEW', symbol, apikey: apikey() },
      }),
    );

    if (!payload.Symbol) throw new UpstreamError('alphavantage', `Alpha Vantage has no fundamentals for ${symbol}`, 404);

    const percent = (key: string): number | null => {
      const value = num(payload[key]);
      return value === null ? null : Math.round(value * 100 * 100) / 100;
    };

    const revenue = num(payload.RevenueTTM);
    const netMargin = num(payload.ProfitMargin);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      valuation: {
        peRatio: num(payload.PERatio),
        pegRatio: num(payload.PEGRatio),
        priceToBook: num(payload.PriceToBookRatio),
        priceToSales: num(payload.PriceToSalesRatioTTM),
        evToEbitda: num(payload.EVToEBITDA),
      },
      profitability: {
        roe: percent('ReturnOnEquityTTM'),
        roa: percent('ReturnOnAssetsTTM'),
        grossMargin:
          revenue && num(payload.GrossProfitTTM)
            ? Math.round((num(payload.GrossProfitTTM)! / revenue) * 100 * 100) / 100
            : null,
        operatingMargin: percent('OperatingMarginTTM'),
        netMargin: netMargin === null ? null : Math.round(netMargin * 100 * 100) / 100,
      },
      growth: {
        revenueGrowth: percent('QuarterlyRevenueGrowthYOY'),
        earningsGrowth: percent('QuarterlyEarningsGrowthYOY'),
      },
      financials: {
        revenue,
        netIncome: revenue && netMargin !== null ? Math.round(revenue * netMargin) : null,
        ebitda: num(payload.EBITDA),
        totalDebt: null,
        totalCash: null,
        freeCashFlow: null,
      },
      perShare: {
        eps: num(payload.EPS),
        bookValue: num(payload.BookValue),
        dividendPerShare: num(payload.DividendPerShare),
      },
      dividend: {
        yield: percent('DividendYield'),
        payoutRatio: null,
      },
      risk: {
        beta: num(payload.Beta),
        debtToEquity: null,
        currentRatio: null,
        interestCoverage: null,
      },
      annual: [],
      marketCap: num(payload.MarketCapitalization),
      fiscalPeriod: payload.LatestQuarter ? `TTM · ${payload.LatestQuarter}` : 'TTM',
    };
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    const symbol = toAlphaVantageSymbol(ref);
    const payload = assertOk(
      await fetchJson<AlphaSeries>(BASE, {
        provider: 'alphavantage',
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol,
          outputsize: RANGE_WINDOW_DAYS[range] > 100 ? 'full' : 'compact',
          apikey: apikey(),
        },
      }),
    );

    const series = payload['Time Series (Daily)'];
    if (!series) throw new UpstreamError('alphavantage', `Alpha Vantage has no candles for ${symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      range,
      interval: '1day',
      candles: Object.entries(series)
        .slice(0, RANGE_WINDOW_DAYS[range])
        .map(([date, row]) => ({
          t: toIsoDate(date),
          o: num(row['1. open']) ?? 0,
          h: num(row['2. high']) ?? 0,
          l: num(row['3. low']) ?? 0,
          c: num(row['4. close']) ?? 0,
          v: num(row['5. volume']) ?? 0,
        }))
        .reverse(),
    };
  },
};
