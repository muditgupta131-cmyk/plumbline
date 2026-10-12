import type { Currency, Exchange, Market } from './market';

export const CANDLE_RANGES = ['1D', '1W', '1M', '6M', '1Y', '5Y'] as const;
export type CandleRange = (typeof CANDLE_RANGES)[number];

export type DataSource = 'finnhub' | 'fmp' | 'twelvedata' | 'alphavantage' | 'sample' | 'local';

export interface SymbolMatch {
  symbol: string;
  exchange: Exchange;
  name: string;
  market: Market;
  currency: Currency;
  sector?: string;
  industry?: string;
  logoUrl?: string;
}

export interface SymbolSearchResponse {
  query: string;
  results: SymbolMatch[];
  source: DataSource;
}

export interface Quote {
  symbol: string;
  exchange: Exchange;
  currency: Currency;
  price: number;
  change: number;
  changePercent: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  week52High: number | null;
  week52Low: number | null;
  asOf: string;
  source: DataSource;
}

export interface QuotesResponse {
  quotes: Quote[];
  failed: string[];
}

export interface CompanyProfile {
  symbol: string;
  exchange: Exchange;
  name: string;
  currency: Currency;
  description: string | null;
  sector: string | null;
  industry: string | null;
  ceo: string | null;
  headquarters: string | null;
  website: string | null;
  employees: number | null;
  logoUrl: string | null;
  ipoDate: string | null;
  marketCap: number | null;
  source: DataSource;
}

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface CandleSeries {
  symbol: string;
  exchange: Exchange;
  currency: Currency;
  range: CandleRange;
  interval: string;
  candles: Candle[];
  source: DataSource;
}

export interface TrendingResponse {
  market: Market | 'ALL';
  results: SymbolMatch[];
}

export interface ProviderStatus {
  id: DataSource;
  budgetRemaining?: number | null;
  spentToday?: number;
  label: string;
  configured: boolean;
  capabilities: string[];
  calls: number;
  failures: number;
  coverageMisses: number;
  lastLatencyMs: number | null;
  lastUsedAt: string | null;
  lastError: string | null;
}

export interface MarketStatus {
  sampleFallback: boolean;
  liveData: boolean;
  providers: ProviderStatus[];
  cache: { entries: number; hits: number; misses: number; hitRate: number };
}

export interface IndexQuote {
  id: string;
  name: string;
  short: string;
  market: Market;
  currency: Currency;
  value: number;
  change: number;
  changePercent: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  asOf: string;
  source: DataSource;
}

export interface UniverseRow {
  symbol: string;
  exchange: Exchange;
  name: string;
  sector: string;
  currency: Currency;
  price: number;
  change: number;
  changePercent: number;
  volume: number | null;
  marketCap: number | null;
}

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
}

export interface MoversResponse {
  market: Market;
  gainers: UniverseRow[];
  losers: UniverseRow[];
  active: UniverseRow[];
  breadth: MarketBreadth;
  source: DataSource | 'derived';
}

export interface SectorPerformance {
  sector: string;
  changePercent: number;
  count: number;
  advancing: number;
  declining: number;
  leader: UniverseRow | null;
  laggard: UniverseRow | null;
}

export type SessionStatus = 'pre-open' | 'open' | 'closed';

export interface ExchangeSession {
  exchange: Exchange;
  market: Market;
  status: SessionStatus;
  timezone: string;
  localTime: string;
  opensInMinutes: number | null;
  closesInMinutes: number | null;
}

export interface MarketOverview {
  market: Market;
  sessions: ExchangeSession[];
  indices: IndexQuote[];
  movers: MoversResponse;
  sectors: SectorPerformance[];
  trending: SymbolMatch[];
  asOf: string;
}

export interface AnnualFigure {
  year: number;
  revenue: number | null;
  netIncome: number | null;
}

export interface Fundamentals {
  symbol: string;
  exchange: Exchange;
  currency: Currency;
  valuation: {
    peRatio: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    evToEbitda: number | null;
  };
  profitability: {
    roe: number | null;
    roa: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
  };
  growth: {
    revenueGrowth: number | null;
    earningsGrowth: number | null;
  };
  financials: {
    revenue: number | null;
    netIncome: number | null;
    ebitda: number | null;
    totalDebt: number | null;
    totalCash: number | null;
    freeCashFlow: number | null;
  };
  perShare: {
    eps: number | null;
    bookValue: number | null;
    dividendPerShare: number | null;
  };
  dividend: {
    yield: number | null;
    payoutRatio: number | null;
  };
  risk: {
    beta: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    interestCoverage: number | null;
  };
  annual: AnnualFigure[];
  fiscalPeriod: string | null;
  marketCap: number | null;
  source: DataSource;
}

export interface StockDetail {
  quote: Quote;
  profile: CompanyProfile | null;
  fundamentals: Fundamentals | null;
  candles: CandleSeries | null;
  session: ExchangeSession;
}

export interface ComparisonEntry {
  symbol: string;
  exchange: Exchange;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: Currency;
  quote: Quote;
  fundamentals: Fundamentals | null;
  logoUrl: string | null;
}

export interface ComparisonResponse {
  entries: ComparisonEntry[];
  failed: string[];
}
