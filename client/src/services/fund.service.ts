import { http } from './httpClient';
import type { FundDetail, FundExploreQuery, FundExploreResponse, FundMatch, FundNavPoint } from '@/types';

export interface FundUniverseStatus {
  schemes: number;
  lastRefreshAt: string | null;
  latestNavDate: string | null;
}

export const fundService = {
  search: (query: string, limit = 8) =>
    http.get<{ results: FundMatch[] }>('/funds/search', { params: { q: query, limit } }),

  detail: (schemeCode: string) => http.get<FundDetail>(`/funds/${schemeCode}`),

  history: (schemeCode: string, days: number) =>
    http.get<{ schemeCode: string; points: FundNavPoint[] }>(`/funds/${schemeCode}/history`, { params: { days } }),

  status: () => http.get<FundUniverseStatus>('/funds/status'),

  explore: (query: FundExploreQuery) =>
    http.get<FundExploreResponse>('/funds/explore', {
      params: Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== null),
      ),
    }),
};
