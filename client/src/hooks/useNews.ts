import { useQuery } from '@tanstack/react-query';
import { newsService } from '@/services';
import { securityKey, type Market, type SecurityRef } from '@/types';

const FEED_STALE_MS = 5 * 60_000;

export function useMarketNews(market: Market, limit = 20) {
  return useQuery({
    queryKey: ['news', 'market', market, limit] as const,
    queryFn: () => newsService.market(market, limit),
    staleTime: FEED_STALE_MS,
  });
}

export function useMarketDigest(market: Market) {
  return useQuery({
    queryKey: ['news', 'digest', market] as const,
    queryFn: () => newsService.digest(market),
    staleTime: 15 * 60_000,
  });
}

export function useSymbolNews(ref: SecurityRef | null, limit = 6) {
  return useQuery({
    queryKey: ['news', 'symbol', ref ? securityKey(ref) : 'none', limit] as const,
    queryFn: () => newsService.symbol(ref!, limit),
    enabled: Boolean(ref),
    staleTime: FEED_STALE_MS,
  });
}
