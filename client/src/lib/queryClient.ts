import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.isAuthError || error.status === 404)) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  health: ['system', 'health'] as const,
  currentUser: ['auth', 'me'] as const,
  marketStatus: ['market', 'status'] as const,
  compare: (keys: string[]) => ['market', 'compare', keys.join(',')] as const,
  overview: (market: string) => ['market', 'overview', market] as const,
  symbolSearch: (query: string, limit: number) => ['market', 'search', query, limit] as const,
  trending: (market: string | undefined, limit: number) => ['market', 'trending', market ?? 'all', limit] as const,
  quote: (key: string) => ['market', 'quote', key] as const,
  quotes: (keys: string[]) => ['market', 'quotes', keys.join(',')] as const,
  profile: (key: string) => ['market', 'profile', key] as const,
  fundamentals: (key: string) => ['market', 'fundamentals', key] as const,
  stock: (key: string, range: string) => ['market', 'stock', key, range] as const,
  portfolios: ['portfolio', 'list'] as const,
  watchlist: ['watchlist', 'list'] as const,
  watchlistAlerts: ['watchlist', 'alerts'] as const,
  notifications: ['notifications'] as const,
  brokerCatalogue: ['brokers', 'catalogue'] as const,
  brokerConnections: ['brokers', 'connections'] as const,
  portfolio: (id: string) => ['portfolio', 'detail', id] as const,
  portfolioTransactions: (id: string) => ['portfolio', 'transactions', id] as const,
  portfolioPerformance: (id: string, range: string) => ['portfolio', 'performance', id, range] as const,
  aiStatus: ['ai', 'status'] as const,
  aiStockAnalysis: (key: string) => ['ai', 'stock', key] as const,
  aiPortfolioAnalysis: (id: string) => ['ai', 'portfolio', id] as const,
  candles: (key: string, range: string) => ['market', 'candles', key, range] as const,
};
