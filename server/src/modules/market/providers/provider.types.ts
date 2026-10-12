import type { Currency, Exchange, Market, SecurityRef } from '../../../types/market.js';

export const PROVIDER_IDS = ['finnhub', 'fmp', 'twelvedata', 'yahoo', 'bse', 'alphavantage', 'sample'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const CAPABILITIES = [
  'search',
  'quote',
  'quotes',
  'profile',
  'candles',
  'indices',
  'fundamentals',
  'fx',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CANDLE_RANGES = ['1D', '1W', '1M', '6M', '1Y', '5Y'] as const;
export type CandleRange = (typeof CANDLE_RANGES)[number];

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
  /** Market capitalisation in the quote currency, when the provider reports one. */
  marketCap: number | null;
}

export interface FxRate {
  base: Currency;
  quote: Currency;
  rate: number;
  asOf: string;
}

export interface MarketProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly capabilities: readonly Capability[];
  isConfigured(): boolean;
  search?(query: string, limit: number): Promise<SymbolMatch[]>;
  quote?(ref: SecurityRef): Promise<Quote>;
  quotes?(refs: SecurityRef[]): Promise<Quote[]>;
  indices?(market?: Market): Promise<IndexQuote[]>;
  // companyName lets a provider fall back to a name lookup when tickers have drifted.
  fundamentals?(ref: SecurityRef, companyName?: string): Promise<Fundamentals>;
  fxRate?(base: Currency, quote: Currency): Promise<FxRate>;
  profile?(ref: SecurityRef): Promise<CompanyProfile>;
  candles?(ref: SecurityRef, range: CandleRange): Promise<CandleSeries>;
}

export const RANGE_WINDOW_DAYS: Record<CandleRange, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 31,
  '6M': 186,
  '1Y': 366,
  '5Y': 1830,
};
