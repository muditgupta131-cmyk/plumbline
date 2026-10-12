import { http } from './httpClient';
import type { MarketDigest, NewsFeed, NewsStatus, SecurityRef } from '@/types';

export const newsService = {
  market: (market: string, limit = 20) => http.get<NewsFeed>('/news', { params: { market, limit } }),

  digest: (market: string) => http.get<MarketDigest>('/news/digest', { params: { market } }),

  symbol: (ref: SecurityRef, limit = 8) =>
    http.get<NewsFeed>(`/news/symbol/${ref.exchange}/${encodeURIComponent(ref.symbol.toUpperCase())}`, {
      params: { limit },
    }),

  status: () => http.get<NewsStatus>('/news/status'),
};
