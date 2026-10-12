import { http } from './httpClient';
import { securityKey, type SecurityRef } from '@/types';
import type {
  CandleRange,
  ComparisonResponse,
  ExchangeSession,
  Fundamentals,
  IndexQuote,
  MarketOverview,
  MoversResponse,
  SectorPerformance,
  CandleSeries,
  CompanyProfile,
  MarketStatus,
  Quote,
  QuotesResponse,
  StockDetail,
  SymbolSearchResponse,
  TrendingResponse,
} from '@/types';

const path = (ref: SecurityRef) => `${ref.exchange}/${encodeURIComponent(ref.symbol.toUpperCase())}`;

export const marketService = {
  search: (query: string, limit = 8) =>
    http.get<SymbolSearchResponse>('/market/search', { params: { q: query, limit } }),

  quote: (ref: SecurityRef) => http.get<Quote>(`/market/quote/${path(ref)}`),

  quotes: (refs: SecurityRef[]) =>
    http.get<QuotesResponse>('/market/quotes', { params: { symbols: refs.map(securityKey).join(',') } }),

  profile: (ref: SecurityRef) => http.get<CompanyProfile>(`/market/profile/${path(ref)}`),

  fundamentals: (ref: SecurityRef) => http.get<Fundamentals>(`/market/fundamentals/${path(ref)}`),

  stock: (ref: SecurityRef, range: CandleRange) =>
    http.get<StockDetail>(`/market/stock/${path(ref)}`, { params: { range } }),

  candles: (ref: SecurityRef, range: CandleRange) =>
    http.get<CandleSeries>(`/market/candles/${path(ref)}`, { params: { range } }),

  trending: (market?: string, limit = 12) =>
    http.get<TrendingResponse>('/market/trending', { params: { market, limit } }),

  overview: (market: string, limit = 6) =>
    http.get<MarketOverview>('/market/overview', { params: { market, limit } }),

  indices: (market?: string) => http.get<{ indices: IndexQuote[] }>('/market/indices', { params: { market } }),

  movers: (market: string, limit = 6) => http.get<MoversResponse>('/market/movers', { params: { market, limit } }),

  sectors: (market: string) =>
    http.get<{ market: string; sectors: SectorPerformance[] }>('/market/sectors', { params: { market } }),

  sessions: (market?: string) =>
    http.get<{ sessions: ExchangeSession[] }>('/market/sessions', { params: { market } }),

  compare: (refs: SecurityRef[]) =>
    http.get<ComparisonResponse>('/market/compare', { params: { symbols: refs.map(securityKey).join(',') } }),

  status: () => http.get<MarketStatus>('/market/status'),
};
