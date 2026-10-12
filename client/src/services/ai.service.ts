import { http } from './httpClient';
import type { AnalysisStatus, PortfolioAnalysis, SecurityRef, StockAnalysis } from '@/types';

const path = (ref: SecurityRef) => `${ref.exchange}/${encodeURIComponent(ref.symbol.toUpperCase())}`;

export const aiService = {
  status: () => http.get<AnalysisStatus>('/ai/status'),

  stockAnalysis: (ref: SecurityRef, refresh = false) =>
    http.get<StockAnalysis>(`/ai/stock/${path(ref)}`, { params: refresh ? { refresh: 'true' } : undefined }),

  portfolioAnalysis: (portfolioId: string, refresh = false) =>
    http.get<PortfolioAnalysis>(`/ai/portfolio/${portfolioId}`, {
      params: refresh ? { refresh: 'true' } : undefined,
    }),
};
