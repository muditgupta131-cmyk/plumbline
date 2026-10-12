import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { marketService } from '@/services';
import { securityKey, type CandleRange, type Market, type SecurityRef } from '@/types';
import { useDebouncedValue } from './useDebouncedValue';

const MIN_QUERY_LENGTH = 1;

export function useSymbolSearch(input: string, limit = 8) {
  const query = useDebouncedValue(input.trim(), 220);
  const enabled = query.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: queryKeys.symbolSearch(query.toLowerCase(), limit),
    queryFn: () => marketService.search(query, limit),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    query,
    isTyping: input.trim() !== query,
    results: result.data?.results ?? [],
  };
}

export function useQuote(ref: SecurityRef | null, options?: { refetchIntervalMs?: number }) {
  return useQuery({
    queryKey: queryKeys.quote(ref ? securityKey(ref) : 'none'),
    queryFn: () => marketService.quote(ref!),
    enabled: Boolean(ref),
    staleTime: 15_000,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
}

export function useQuotes(refs: SecurityRef[], enabled = true) {
  const keys = refs.map(securityKey);

  return useQuery({
    queryKey: queryKeys.quotes(keys),
    queryFn: () => marketService.quotes(refs),
    enabled: enabled && refs.length > 0,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useCandles(ref: SecurityRef | null, range: CandleRange) {
  return useQuery({
    queryKey: queryKeys.candles(ref ? securityKey(ref) : 'none', range),
    queryFn: () => marketService.candles(ref!, range),
    enabled: Boolean(ref),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useStockDetail(ref: SecurityRef | null, range: CandleRange) {
  return useQuery({
    queryKey: queryKeys.stock(ref ? securityKey(ref) : 'none', range),
    queryFn: () => marketService.stock(ref!, range),
    enabled: Boolean(ref),
    staleTime: 15_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTrendingSymbols(market?: Market, limit = 12) {
  return useQuery({
    queryKey: queryKeys.trending(market, limit),
    queryFn: () => marketService.trending(market, limit),
    staleTime: 30 * 60_000,
  });
}

export function useIndices(market?: Market) {
  return useQuery({
    queryKey: ['market', 'indices', market ?? 'all'] as const,
    queryFn: () => marketService.indices(market),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarketOverview(market: Market, limit = 6) {
  return useQuery({
    queryKey: queryKeys.overview(market),
    queryFn: () => marketService.overview(market, limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useComparison(refs: SecurityRef[]) {
  const keys = refs.map(securityKey);

  return useQuery({
    queryKey: queryKeys.compare(keys),
    queryFn: () => marketService.compare(refs),
    enabled: refs.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMarketStatus() {
  return useQuery({
    queryKey: queryKeys.marketStatus,
    queryFn: marketService.status,
    staleTime: 5 * 60_000,
  });
}
