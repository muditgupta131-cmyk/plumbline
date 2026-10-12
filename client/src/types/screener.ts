import type { Currency, Exchange, Market } from './market';

export const SCREENER_SORT_FIELDS = [
  'marketCap',
  'peRatio',
  'roe',
  'revenueGrowth',
  'dividendYield',
  'changePercent',
  'price',
  'netMargin',
] as const;
export type ScreenerSortField = (typeof SCREENER_SORT_FIELDS)[number];

export interface ScreenerRow {
  symbol: string;
  exchange: Exchange;
  market: Market;
  name: string;
  sector: string;
  industry: string | null;
  currency: Currency;
  price: number;
  changePercent: number;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  roe: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  revenue: number | null;
  rangePosition: number | null;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  total: number;
  universe: number;
  sectors: string[];
  page: number;
  limit: number;
  truncated: boolean;
}

export interface ScreenerQuery {
  market?: Market;
  sector?: string;
  maxPeRatio?: number;
  minRoe?: number;
  maxDebtToEquity?: number;
  minRevenueGrowth?: number;
  minDividendYield?: number;
  maxRangePosition?: number;
  sortBy: ScreenerSortField;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
}
