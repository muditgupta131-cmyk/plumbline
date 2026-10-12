import { INDEX_DEFINITIONS } from '../../../data/indices.seed.js';
import { benchmarkFor, type SectorBenchmark } from '../../../data/sectorBenchmarks.js';
import { SEED_INDEX, SEED_SYMBOLS, type SeedSymbol } from '../../../data/symbols.seed.js';
import {
  currencyForExchange,
  EXCHANGE_MARKET,
  securityKey,
  type Currency,
  type Market,
  type SecurityRef,
} from '../../../types/market.js';
import {
  RANGE_WINDOW_DAYS,
  type Candle,
  type CandleRange,
  type CandleSeries,
  type AnnualFigure,
  type CompanyProfile,
  type Fundamentals,
  type FxRate,
  type IndexQuote,
  type MarketProvider,
  type Quote,
  type SymbolMatch,
} from './provider.types.js';

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fallbackSeed(ref: SecurityRef): SeedSymbol {
  const market = EXCHANGE_MARKET[ref.exchange];
  const base = 40 + (hash(securityKey(ref)) % 3800) / 10;
  return {
    symbol: ref.symbol.toUpperCase(),
    name: ref.symbol.toUpperCase(),
    exchange: ref.exchange,
    market,
    currency: currencyForExchange(ref.exchange),
    sector: 'Unclassified',
    industry: 'Unclassified',
    referencePrice: market === 'IN' ? round(base * 12) : round(base),
    marketCap: 0,
    popular: false,
  };
}

function seedFor(ref: SecurityRef): SeedSymbol {
  return SEED_INDEX.get(securityKey(ref)) ?? fallbackSeed(ref);
}

function sessionSeed(ref: SecurityRef): number {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  return hash(`${securityKey(ref)}:${bucket}`);
}

function toMatch(entry: SeedSymbol): SymbolMatch {
  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    name: entry.name,
    market: entry.market,
    currency: entry.currency,
    sector: entry.sector,
    industry: entry.industry,
  };
}

function buildQuote(ref: SecurityRef): Quote {
  const entry = seedFor(ref);
  const random = rng(sessionSeed(ref));
  const changePercent = round((random() - 0.48) * 6.4);
  const previousClose = round(entry.referencePrice / (1 + changePercent / 100));
  const price = round(entry.referencePrice);
  const change = round(price - previousClose);
  const spread = Math.max(price * 0.012, 0.02);

  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    currency: entry.currency,
    price,
    change,
    changePercent,
    open: round(previousClose * (1 + (random() - 0.5) * 0.008)),
    high: round(Math.max(price, previousClose) + spread * random()),
    low: round(Math.min(price, previousClose) - spread * random()),
    previousClose,
    volume: Math.round(250_000 + random() * 9_500_000),
    marketCap: entry.marketCap || null,
    week52High: round(price * (1.12 + random() * 0.28)),
    week52Low: round(price * (0.62 + random() * 0.2)),
    asOf: new Date().toISOString(),
  };
}

function buildCandles(ref: SecurityRef, range: CandleRange): CandleSeries {
  const entry = seedFor(ref);
  const quote = buildQuote(ref);
  const days = RANGE_WINDOW_DAYS[range];
  const points = range === '1D' ? 78 : range === '1W' ? 35 : Math.min(days, 260);
  const stepMs = (days * 86_400_000) / points;
  const random = rng(hash(`${securityKey(ref)}:${range}`));
  const drift = range === '1D' || range === '1W' ? 0.004 : 0.014;

  const closes: number[] = [];
  let value = quote.price;
  for (let i = 0; i < points; i += 1) {
    closes.push(value);
    value = value / (1 + (random() - 0.5) * drift * 2);
  }
  closes.reverse();

  const candles: Candle[] = closes.map((close, index) => {
    const open = index === 0 ? close * (1 - (random() - 0.5) * 0.006) : closes[index - 1];
    const wick = close * 0.006 * (0.4 + random());
    return {
      t: new Date(Date.now() - (points - index) * stepMs).toISOString(),
      o: round(open),
      h: round(Math.max(open, close) + wick),
      l: round(Math.min(open, close) - wick),
      c: round(close),
      v: Math.round(120_000 + random() * 4_800_000),
    };
  });

  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    currency: entry.currency,
    range,
    interval: range === '1D' ? '5min' : range === '1W' ? '1hour' : '1day',
    candles,
  };
}

function buildProfile(ref: SecurityRef): CompanyProfile {
  const entry = seedFor(ref);
  const country = entry.market === 'IN' ? 'India' : 'the United States';

  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    name: entry.name,
    currency: entry.currency,
    description:
      `${entry.name} is listed on the ${entry.exchange} and classified under the ${entry.sector} sector, ` +
      `${entry.industry} industry, in ${country}. No connected provider publishes a filed business ` +
      `description for this listing, so only its classification is shown here.`,
    sector: entry.sector,
    industry: entry.industry,
    ceo: null,
    headquarters: null,
    website: null,
    employees: null,
    logoUrl: null,
    ipoDate: null,
    marketCap: entry.marketCap || null,
  };
}

function score(entry: SeedSymbol, query: string): number {
  const symbol = entry.symbol.toLowerCase();
  const name = entry.name.toLowerCase();
  if (symbol === query) return 100;
  if (symbol.startsWith(query)) return 85;
  if (name.startsWith(query)) return 75;
  if (name.includes(` ${query}`)) return 60;
  if (name.includes(query)) return 45;
  if (symbol.includes(query)) return 35;
  return 0;
}

function buildIndexQuote(definition: (typeof INDEX_DEFINITIONS)[number]): IndexQuote {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const random = rng(hash(`${definition.id}:${bucket}`));
  const changePercent = round((random() - 0.46) * 2.6);
  const value = round(definition.referenceValue, 2);
  const previousClose = round(value / (1 + changePercent / 100), 2);

  return {
    id: definition.id,
    name: definition.name,
    short: definition.short,
    market: definition.market,
    currency: definition.currency,
    value,
    change: round(value - previousClose, 2),
    changePercent,
    open: round(previousClose * (1 + (random() - 0.5) * 0.004), 2),
    high: round(Math.max(value, previousClose) * (1 + random() * 0.003), 2),
    low: round(Math.min(value, previousClose) * (1 - random() * 0.003), 2),
    previousClose,
    asOf: new Date().toISOString(),
  };
}

function jitter(random: () => number, base: number, spread: number): number {
  return round(base * (1 + (random() - 0.5) * spread), 2);
}

function buildFundamentals(ref: SecurityRef): Fundamentals {
  const entry = seedFor(ref);
  // Keyed on the company, not the listing — RELIANCE reports the same fundamentals on NSE and BSE.
  const random = rng(hash(`${ref.symbol.toUpperCase()}:fundamentals`));
  const sector: SectorBenchmark = benchmarkFor(entry.sector);

  const price = entry.referencePrice;
  const marketCap = entry.marketCap || price * 1_200_000;

  const peRatio = jitter(random, sector.pe, 0.5);
  const priceToSales = jitter(random, sector.ps, 0.5);
  const roe = jitter(random, sector.roe, 0.4);
  const netMargin = jitter(random, sector.netMargin, 0.35);
  const growth = jitter(random, sector.growth, 0.7);
  const debtToEquity = jitter(random, sector.debtToEquity, 0.6);
  const dividendYield = round(Math.max(0, jitter(random, sector.dividendYield, 0.8)), 2);

  const priceToBook = round((peRatio * roe) / 100, 2);
  const eps = round(price / peRatio, 2);
  const bookValue = round(price / priceToBook, 2);
  const revenue = Math.round(marketCap / priceToSales);
  const netIncome = Math.round((revenue * netMargin) / 100);
  const ebitda = Math.round((revenue * (netMargin + 9)) / 100);
  const equity = Math.round(marketCap / priceToBook);
  const totalDebt = Math.round(equity * debtToEquity);
  const totalCash = Math.round(totalDebt * (0.25 + random() * 0.7));
  const dividendPerShare = round((price * dividendYield) / 100, 2);

  const annual: AnnualFigure[] = [];
  const thisYear = new Date().getFullYear();
  for (let offset = 4; offset >= 0; offset -= 1) {
    const decay = (1 + growth / 100) ** offset;
    const yearRevenue = Math.round(revenue / decay);
    annual.push({
      year: thisYear - offset,
      revenue: yearRevenue,
      netIncome: Math.round((yearRevenue * (netMargin - offset * 0.4)) / 100),
    });
  }

  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    currency: entry.currency,
    valuation: {
      peRatio,
      pegRatio: growth > 0 ? round(peRatio / growth, 2) : null,
      priceToBook,
      priceToSales,
      evToEbitda: round((marketCap + totalDebt - totalCash) / ebitda, 2),
    },
    profitability: {
      roe,
      roa: round(roe / (1 + debtToEquity), 2),
      grossMargin: sector.grossMargin === null ? null : jitter(random, sector.grossMargin, 0.2),
      operatingMargin: round(netMargin * 1.35, 2),
      netMargin,
    },
    growth: {
      revenueGrowth: growth,
      earningsGrowth: round(growth * (1 + (random() - 0.4) * 0.6), 2),
    },
    financials: { revenue, netIncome, ebitda, totalDebt, totalCash, freeCashFlow: Math.round(netIncome * 0.86) },
    perShare: { eps, bookValue, dividendPerShare },
    dividend: {
      yield: dividendYield,
      payoutRatio: eps > 0 ? round((dividendPerShare / eps) * 100, 2) : null,
    },
    risk: {
      beta: round(0.6 + random() * 1.1, 2),
      debtToEquity,
      currentRatio: round(1.1 + random() * 1.5, 2),
      interestCoverage: round(4 + random() * 14, 2),
    },
    annual,
    marketCap,
    fiscalPeriod: `TTM ${thisYear}`,
  };
}

export const sampleProvider: MarketProvider = {
  id: 'sample',
  label: 'Plumbline sample data',
  capabilities: ['search', 'quote', 'quotes', 'profile', 'candles', 'indices', 'fundamentals', 'fx'],
  isConfigured: () => true,

  async search(query: string, limit: number): Promise<SymbolMatch[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return SEED_SYMBOLS.slice(0, limit).map(toMatch);

    return SEED_SYMBOLS.map((entry) => ({ entry, value: score(entry, needle) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit)
      .map((item) => toMatch(item.entry));
  },

  async quote(ref: SecurityRef): Promise<Quote> {
    return buildQuote(ref);
  },

  async quotes(refs: SecurityRef[]): Promise<Quote[]> {
    return refs.map(buildQuote);
  },

  async indices(market?: Market): Promise<IndexQuote[]> {
    return INDEX_DEFINITIONS.filter((definition) => !market || definition.market === market).map(buildIndexQuote);
  },

  async profile(ref: SecurityRef): Promise<CompanyProfile> {
    return buildProfile(ref);
  },

  async candles(ref: SecurityRef, range: CandleRange): Promise<CandleSeries> {
    return buildCandles(ref, range);
  },

  async fundamentals(ref: SecurityRef): Promise<Fundamentals> {
    return buildFundamentals(ref);
  },

  async fxRate(base: Currency, quote: Currency): Promise<FxRate> {
    const random = rng(hash(`${base}${quote}:${Math.floor(Date.now() / (60 * 60_000))}`));
    const reference = base === quote ? 1 : base === 'USD' ? 88.4 : 1 / 88.4;
    const rate = base === quote ? 1 : round(reference * (1 + (random() - 0.5) * 0.01), 4);

    return { base, quote, rate, asOf: new Date().toISOString() };
  },
};
