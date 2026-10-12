import { env } from '../../../config/env.js';
import {
  currencyForExchange,
  EXCHANGE_MARKET,
  type Currency,
  type Market,
  type SecurityRef,
} from '../../../types/market.js';
import { INDEX_DEFINITIONS } from '../../../data/indices.seed.js';
import {
  RANGE_WINDOW_DAYS,
  type AnnualFigure,
  type CandleRange,
  type CandleSeries,
  type CompanyProfile,
  type Fundamentals,
  type FxRate,
  type IndexQuote,
  type MarketProvider,
  type Quote,
  type SymbolMatch,
} from './provider.types.js';
import { fetchJson, toIsoDate, UpstreamError } from './upstream.js';
import { normaliseExchange, toYahooSymbol } from './symbolMapping.js';

// FMP retired the /api/v3 endpoints for new accounts; /stable is the current surface.
const BASE = 'https://financialmodelingprep.com/stable';

interface StableQuote {
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  changePercentage?: number;
  dayLow?: number;
  dayHigh?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  volume?: number;
  open?: number;
  previousClose?: number;
  exchange?: string;
  timestamp?: number;
}

interface StableSearchItem {
  symbol: string;
  name: string;
  currency?: string;
  exchange?: string;
  exchangeFullName?: string;
}

interface StableProfile {
  symbol: string;
  companyName?: string;
  currency?: string;
  exchange?: string;
  description?: string;
  sector?: string;
  industry?: string;
  ceo?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  fullTimeEmployees?: string | number;
  image?: string;
  ipoDate?: string;
  marketCap?: number;
  beta?: number;
}

type Metrics = Record<string, number | string | null | undefined>;

interface StableIncome {
  date?: string;
  fiscalYear?: string;
  revenue?: number;
  netIncome?: number;
  ebitda?: number;
}

interface StableBalance {
  totalDebt?: number;
  cashAndCashEquivalents?: number;
}

interface StableEod {
  symbol?: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function apikey(): string {
  return env.FMP_API_KEY ?? '';
}

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  return fetchJson<T>(`${BASE}/${path}`, { provider: 'fmp', params: { ...params, apikey: apikey() } });
}

function firstOf<T>(payload: T[] | undefined): T | undefined {
  return Array.isArray(payload) ? payload[0] : undefined;
}

function toQuote(raw: StableQuote, ref: SecurityRef): Quote {
  return {
    symbol: ref.symbol.toUpperCase(),
    exchange: ref.exchange,
    currency: currencyForExchange(ref.exchange),
    price: raw.price ?? 0,
    change: raw.change ?? 0,
    changePercent: raw.changePercentage ?? 0,
    open: raw.open ?? null,
    high: raw.dayHigh ?? null,
    low: raw.dayLow ?? null,
    previousClose: raw.previousClose ?? null,
    volume: raw.volume ?? null,
    marketCap: raw.marketCap ?? null,
    week52High: raw.yearHigh ?? null,
    week52Low: raw.yearLow ?? null,
    asOf: raw.timestamp ? toIsoDate(raw.timestamp) : new Date().toISOString(),
  };
}

function headquarters(profile: StableProfile): string | null {
  const parts = [profile.city, profile.state, profile.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function numeric(metrics: Metrics, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = metrics[key];
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function percent(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100 * 100) / 100;
}

export const fmpProvider: MarketProvider = {
  id: 'fmp',
  label: 'Financial Modeling Prep',
  // Batch quotes and intraday candles are restricted on the entry plan, so they are not claimed.
  capabilities: ['search', 'quote', 'profile', 'candles', 'indices', 'fundamentals', 'fx'],
  isConfigured: () => Boolean(env.FMP_API_KEY),

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const payload = await get<StableSearchItem[]>('search-symbol', { query, limit });

    return (Array.isArray(payload) ? payload : []).slice(0, limit).flatMap((item) => {
      const exchange = normaliseExchange(item.exchange) ?? normaliseExchange(item.exchangeFullName);
      if (!exchange) return [];

      return [
        {
          symbol: (item.symbol.split('.')[0] ?? item.symbol).toUpperCase(),
          exchange,
          name: item.name,
          market: EXCHANGE_MARKET[exchange],
          currency: currencyForExchange(exchange),
        },
      ];
    });
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    const symbol = toYahooSymbol(ref);
    const raw = firstOf(await get<StableQuote[]>('quote', { symbol }));

    if (!raw?.price) throw new UpstreamError('fmp', `FMP has no quote for ${symbol}`, 404);
    return toQuote(raw, ref);
  },

  async indices(market?: Market): Promise<IndexQuote[]> {
    const definitions = INDEX_DEFINITIONS.filter((definition) => !market || definition.market === market);

    const settled = await Promise.all(
      definitions.map(async (definition) => {
        try {
          const raw = firstOf(await get<StableQuote[]>('quote', { symbol: definition.providerSymbol }));
          if (!raw?.price) return null;

          return {
            id: definition.id,
            name: definition.name,
            short: definition.short,
            market: definition.market,
            currency: definition.currency,
            value: raw.price,
            change: raw.change ?? 0,
            changePercent: raw.changePercentage ?? 0,
            open: raw.open ?? null,
            high: raw.dayHigh ?? null,
            low: raw.dayLow ?? null,
            previousClose: raw.previousClose ?? null,
            asOf: raw.timestamp ? toIsoDate(raw.timestamp) : new Date().toISOString(),
          } satisfies IndexQuote;
        } catch {
          return null;
        }
      }),
    );

    const indices = settled.filter((index): index is IndexQuote => index !== null);
    if (!indices.length) throw new UpstreamError('fmp', 'FMP returned no index quotes', 404);

    return indices;
  },

  async fxRate(base: Currency, quote: Currency): Promise<FxRate> {
    if (base === quote) return { base, quote, rate: 1, asOf: new Date().toISOString() };

    const pair = `${base}${quote}`;
    const raw = firstOf(await get<StableQuote[]>('quote', { symbol: pair }));

    if (!raw?.price) throw new UpstreamError('fmp', `FMP has no rate for ${pair}`, 404);

    return {
      base,
      quote,
      rate: raw.price,
      asOf: raw.timestamp ? toIsoDate(raw.timestamp) : new Date().toISOString(),
    };
  },

  async profile(ref: SecurityRef): Promise<CompanyProfile> {
    const symbol = toYahooSymbol(ref);
    const profile = firstOf(await get<StableProfile[]>('profile', { symbol }));

    if (!profile?.companyName) throw new UpstreamError('fmp', `FMP has no profile for ${symbol}`, 404);

    const employees = Number(profile.fullTimeEmployees);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: normaliseExchange(profile.exchange) ?? ref.exchange,
      name: profile.companyName,
      currency: currencyForExchange(ref.exchange),
      description: profile.description ?? null,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
      ceo: profile.ceo ?? null,
      headquarters: headquarters(profile),
      website: profile.website ?? null,
      employees: Number.isFinite(employees) && employees > 0 ? employees : null,
      logoUrl: profile.image ?? null,
      ipoDate: profile.ipoDate ?? null,
      marketCap: profile.marketCap ?? null,
    };
  },

  async fundamentals(ref: SecurityRef): Promise<Fundamentals> {
    const symbol = toYahooSymbol(ref);

    const [ratios, metrics, income, balance, profile] = await Promise.all([
      get<Metrics[]>('ratios-ttm', { symbol }).catch((): Metrics[] => []),
      get<Metrics[]>('key-metrics-ttm', { symbol }).catch((): Metrics[] => []),
      get<StableIncome[]>('income-statement', { symbol, limit: 5 }).catch((): StableIncome[] => []),
      get<StableBalance[]>('balance-sheet-statement', { symbol, limit: 1 }).catch((): StableBalance[] => []),
      get<StableProfile[]>('profile', { symbol }).catch((): StableProfile[] => []),
    ]);

    const ratio = firstOf(ratios) ?? ({} as Metrics);
    const metric = firstOf(metrics) ?? ({} as Metrics);
    const latest = firstOf(income) ?? ({} as StableIncome);
    const sheet = firstOf(balance) ?? ({} as StableBalance);
    const company = firstOf(profile) ?? ({} as StableProfile);
    const combined: Metrics = { ...metric, ...ratio };

    if (!Object.keys(combined).length && !latest.revenue) {
      throw new UpstreamError('fmp', `FMP has no fundamentals for ${symbol}`, 404);
    }

    const previous = Array.isArray(income) ? income[1] : undefined;
    const growth = (current?: number, prior?: number) =>
      current && prior ? Math.round(((current - prior) / Math.abs(prior)) * 100 * 100) / 100 : null;

    const annual: AnnualFigure[] = (Array.isArray(income) ? income : [])
      .slice(0, 5)
      .map((row) => ({
        year: Number(row.fiscalYear ?? row.date?.slice(0, 4) ?? 0),
        revenue: row.revenue ?? null,
        netIncome: row.netIncome ?? null,
      }))
      .filter((row) => row.year > 0)
      .reverse();

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      valuation: {
        peRatio: numeric(combined, 'priceToEarningsRatioTTM', 'peRatioTTM'),
        pegRatio: numeric(combined, 'priceToEarningsGrowthRatioTTM', 'pegRatioTTM'),
        priceToBook: numeric(combined, 'priceToBookRatioTTM', 'pbRatioTTM'),
        priceToSales: numeric(combined, 'priceToSalesRatioTTM'),
        evToEbitda: numeric(combined, 'evToEBITDATTM', 'enterpriseValueMultipleTTM'),
      },
      profitability: {
        roe: percent(numeric(combined, 'returnOnEquityTTM')),
        roa: percent(numeric(combined, 'returnOnAssetsTTM')),
        grossMargin: percent(numeric(combined, 'grossProfitMarginTTM')),
        operatingMargin: percent(numeric(combined, 'operatingProfitMarginTTM', 'ebitMarginTTM')),
        netMargin: percent(numeric(combined, 'netProfitMarginTTM', 'netIncomeMarginTTM')),
      },
      growth: {
        revenueGrowth: growth(latest.revenue, previous?.revenue),
        earningsGrowth: growth(latest.netIncome, previous?.netIncome),
      },
      financials: {
        revenue: latest.revenue ?? null,
        netIncome: latest.netIncome ?? null,
        ebitda: latest.ebitda ?? null,
        totalDebt: sheet.totalDebt ?? null,
        totalCash: sheet.cashAndCashEquivalents ?? null,
        freeCashFlow: numeric(combined, 'freeCashFlowTTM'),
      },
      perShare: {
        eps: numeric(combined, 'netIncomePerShareTTM', 'epsTTM'),
        bookValue: numeric(combined, 'bookValuePerShareTTM'),
        dividendPerShare: numeric(combined, 'dividendPerShareTTM'),
      },
      dividend: {
        yield: percent(numeric(combined, 'dividendYieldTTM', 'dividendYielTTM')),
        payoutRatio: percent(numeric(combined, 'dividendPayoutRatioTTM', 'payoutRatioTTM')),
      },
      risk: {
        beta: company.beta ?? null,
        debtToEquity: numeric(combined, 'debtToEquityRatioTTM', 'debtEquityRatioTTM'),
        currentRatio: numeric(combined, 'currentRatioTTM'),
        interestCoverage: numeric(combined, 'interestCoverageRatioTTM', 'interestCoverageTTM'),
      },
      annual,
      marketCap: company.marketCap ?? null,
      fiscalPeriod: latest.date ? `TTM · FY${latest.date.slice(0, 4)}` : 'TTM',
    };
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    const symbol = toYahooSymbol(ref);
    const days = RANGE_WINDOW_DAYS[range];
    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    const payload = await get<StableEod[] | { historical?: StableEod[] }>('historical-price-eod/full', {
      symbol,
      from,
      to,
    });

    const rows = Array.isArray(payload) ? payload : (payload.historical ?? []);
    if (!rows.length) throw new UpstreamError('fmp', `FMP has no candles for ${symbol}`, 404);

    const ordered = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      range,
      // Intraday history is restricted on the entry plan, so short ranges are served as daily bars.
      interval: '1day',
      candles: ordered.map((row) => ({
        t: toIsoDate(row.date),
        o: row.open,
        h: row.high,
        l: row.low,
        c: row.close,
        v: row.volume,
      })),
    };
  },
};
