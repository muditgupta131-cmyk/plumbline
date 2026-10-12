import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fundService } from '@/services';
import type { FundExploreQuery } from '@/types';
import { useDebouncedValue } from './useDebouncedValue';

export function useFundSearch(input: string, limit = 8) {
  const query = useDebouncedValue(input.trim(), 300);
  const enabled = query.length >= 3;

  const result = useQuery({
    queryKey: ['funds', 'search', query.toLowerCase(), limit] as const,
    queryFn: () => fundService.search(query, limit),
    enabled,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });

  return { ...result, query, isTyping: input.trim() !== query, results: result.data?.results ?? [] };
}

export function useFundUniverse() {
  return useQuery({
    queryKey: ['funds', 'status'] as const,
    queryFn: fundService.status,
    staleTime: 60 * 60_000,
  });
}

export function useFundExplorer(query: FundExploreQuery) {
  return useQuery({
    // The first call builds the whole-universe dataset server side, so keep results while refetching.
    queryKey: ['funds', 'explore', query] as const,
    queryFn: () => fundService.explore(query),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useFundDetail(schemeCode: string | undefined) {
  return useQuery({
    queryKey: ['funds', 'detail', schemeCode] as const,
    queryFn: () => fundService.detail(schemeCode!),
    enabled: Boolean(schemeCode),
    staleTime: 30 * 60_000,
  });
}

export function useFundHistory(schemeCode: string | undefined, days: number) {
  return useQuery({
    queryKey: ['funds', 'history', schemeCode, days] as const,
    queryFn: () => fundService.history(schemeCode!, days),
    enabled: Boolean(schemeCode),
    staleTime: 6 * 60 * 60_000,
    placeholderData: keepPreviousData,
  });
}
