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
import { fromYahooSymbol, normaliseExchange, toYahooSymbol } from './symbolMapping.js';

const BASE = 'https://finnhub.io/api/v1';

interface FinnhubQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

interface FinnhubProfile {
  name?: string;
  country?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  weburl?: string;
}

interface FinnhubMetric {
  metric?: Record<string, number | string | null>;
}

interface FinnhubSearch {
  result?: Array<{ symbol: string; displaySymbol: string; description: string; type: string }>;
}

interface FinnhubCandles {
  s: string;
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  v?: number[];
  t?: number[];
}

const RESOLUTION: Record<CandleRange, string> = {
  '1D': '5',
  '1W': '60',
  '1M': 'D',
  '6M': 'D',
  '1Y': 'D',
  '5Y': 'W',
};

function token(): string {
  return env.FINNHUB_API_KEY ?? '';
}

export const finnhubProvider: MarketProvider = {
  id: 'finnhub',
  label: 'Finnhub',
  capabilities: ['search', 'quote', 'profile', 'candles', 'fundamentals'],
  isConfigured: () => Boolean(env.FINNHUB_API_KEY),

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const payload = await fetchJson<FinnhubSearch>(`${BASE}/search`, {
      provider: 'finnhub',
      params: { q: query, token: token() },
    });

    return (payload.result ?? [])
      .filter((item) => item.type === 'Common Stock' || item.type === 'ADR' || item.type === '')
      .slice(0, limit)
      .map((item) => {
        const ref = fromYahooSymbol(item.symbol, 'NASDAQ');
        return {
          symbol: ref.symbol,
          exchange: ref.exchange,
          name: item.description,
          market: EXCHANGE_MARKET[ref.exchange],
          currency: currencyForExchange(ref.exchange),
        };
      });
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    const symbol = toYahooSymbol(ref);
    const [quote, metrics] = await Promise.all([
      fetchJson<FinnhubQuote>(`${BASE}/quote`, { provider: 'finnhub', params: { symbol, token: token() } }),
      fetchJson<FinnhubMetric>(`${BASE}/stock/metric`, {
        provider: 'finnhub',
        params: { symbol, metric: 'price', token: token() },
      }).catch(() => ({ metric: {} }) as FinnhubMetric),
    ]);

    if (!quote.c) throw new UpstreamError('finnhub', `Finnhub has no quote for ${symbol}`, 404);

    const metric = metrics.metric ?? {};
    const numeric = (key: string): number | null => {
      const value = metric[key];
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    };

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      price: quote.c,
      change: quote.d ?? quote.c - quote.pc,
      changePercent: quote.dp ?? ((quote.c - quote.pc) / quote.pc) * 100,
      open: quote.o || null,
      high: quote.h || null,
      low: quote.l || null,
      previousClose: quote.pc || null,
      volume: null,
      marketCap: null,
      week52High: numeric('52WeekHigh'),
      week52Low: numeric('52WeekLow'),
      asOf: quote.t ? toIsoDate(quote.t) : new Date().toISOString(),
    };
  },

  async profile(ref: SecurityRef): Promise<CompanyProfile> {
    const symbol = toYahooSymbol(ref);
    const payload = await fetchJson<FinnhubProfile>(`${BASE}/stock/profile2`, {
      provider: 'finnhub',
      params: { symbol, token: token() },
    });

    if (!payload.name) throw new UpstreamError('finnhub', `Finnhub has no profile for ${symbol}`, 404);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: normaliseExchange(payload.exchange) ?? ref.exchange,
      name: payload.name,
      currency: currencyForExchange(ref.exchange),
      description: null,
      sector: payload.finnhubIndustry ?? null,
      industry: payload.finnhubIndustry ?? null,
      ceo: null,
      headquarters: payload.country ?? null,
      website: payload.weburl ?? null,
      employees: null,
      logoUrl: payload.logo ?? null,
      ipoDate: payload.ipo ?? null,
      marketCap: payload.marketCapitalization ? payload.marketCapitalization * 1_000_000 : null,
    };
  },

  async fundamentals(ref: SecurityRef): Promise<Fundamentals> {
    const symbol = toYahooSymbol(ref);
    const payload = await fetchJson<FinnhubMetric>(`${BASE}/stock/metric`, {
      provider: 'finnhub',
      params: { symbol, metric: 'all', token: token() },
    });

    const metric = payload.metric ?? {};
    if (!Object.keys(metric).length) {
      throw new UpstreamError('finnhub', `Finnhub has no fundamentals for ${symbol}`, 404);
    }

    const pick = (...keys: string[]): number | null => {
      for (const key of keys) {
        const value = metric[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
      return null;
    };

    const scaleMillions = (value: number | null): number | null => (value === null ? null : value * 1_000_000);

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      valuation: {
        peRatio: pick('peTTM', 'peBasicExclExtraTTM'),
        pegRatio: pick('pegTTM'),
        priceToBook: pick('pbQuarterly', 'pbAnnual'),
        priceToSales: pick('psTTM', 'psAnnual'),
        evToEbitda: pick('currentEv/freeCashFlowTTM'),
      },
      profitability: {
        roe: pick('roeTTM', 'roeRfy'),
        roa: pick('roaTTM', 'roaRfy'),
        grossMargin: pick('grossMarginTTM', 'grossMarginAnnual'),
        operatingMargin: pick('operatingMarginTTM', 'operatingMarginAnnual'),
        netMargin: pick('netProfitMarginTTM', 'netProfitMarginAnnual'),
      },
      growth: {
        revenueGrowth: pick('revenueGrowthTTMYoy', 'revenueGrowthQuarterlyYoy'),
        earningsGrowth: pick('epsGrowthTTMYoy', 'epsGrowthQuarterlyYoy'),
      },
      financials: {
        revenue: scaleMillions(pick('revenueTTM')),
        netIncome: scaleMillions(pick('netIncomeTTM')),
        ebitda: scaleMillions(pick('ebitdaTTM')),
        totalDebt: scaleMillions(pick('totalDebtQuarterly', 'totalDebtAnnual')),
        totalCash: scaleMillions(pick('cashAndCashEquivalentsQuarterly')),
        freeCashFlow: scaleMillions(pick('freeCashFlowTTM', 'freeCashFlowAnnual')),
      },
      perShare: {
        eps: pick('epsTTM', 'epsBasicExclExtraItemsTTM'),
        bookValue: pick('bookValuePerShareQuarterly', 'bookValuePerShareAnnual'),
        dividendPerShare: pick('dividendPerShareTTM', 'dividendsPerShareTTM'),
      },
      dividend: {
        yield: pick('dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'),
        payoutRatio: pick('payoutRatioTTM', 'payoutRatioAnnual'),
      },
      risk: {
        beta: pick('beta'),
        debtToEquity: pick('totalDebt/totalEquityQuarterly', 'totalDebt/totalEquityAnnual'),
        currentRatio: pick('currentRatioQuarterly', 'currentRatioAnnual'),
        interestCoverage: pick('netInterestCoverageTTM', 'netInterestCoverageAnnual'),
      },
      annual: [],
      marketCap: scaleMillions(pick('marketCapitalization')),
      fiscalPeriod: 'TTM',
    };
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    const symbol = toYahooSymbol(ref);
    const to = Math.floor(Date.now() / 1000);
    const from = to - RANGE_WINDOW_DAYS[range] * 86_400;

    const payload = await fetchJson<FinnhubCandles>(`${BASE}/stock/candle`, {
      provider: 'finnhub',
      params: { symbol, resolution: RESOLUTION[range], from, to, token: token() },
    });

    if (payload.s !== 'ok' || !payload.t?.length) {
      throw new UpstreamError('finnhub', `Finnhub has no candles for ${symbol}`, 404);
    }

    return {
      symbol: ref.symbol.toUpperCase(),
      exchange: ref.exchange,
      currency: currencyForExchange(ref.exchange),
      range,
      interval: RESOLUTION[range],
      candles: payload.t.map((timestamp, index) => ({
        t: toIsoDate(timestamp),
        o: payload.o?.[index] ?? 0,
        h: payload.h?.[index] ?? 0,
        l: payload.l?.[index] ?? 0,
        c: payload.c?.[index] ?? 0,
        v: payload.v?.[index] ?? 0,
      })),
    };
  },
};
