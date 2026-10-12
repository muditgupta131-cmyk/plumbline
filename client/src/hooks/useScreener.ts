import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { screenerService } from '@/services';
import type { ScreenerQuery } from '@/types';

export function useScreener(query: ScreenerQuery) {
  return useQuery({
    queryKey: ['screener', query] as const,
    queryFn: () => screenerService.screen(query),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
