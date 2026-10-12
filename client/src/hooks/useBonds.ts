import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { bondService } from '@/services';
import type { BondQuery } from '@/types';

export function useBonds(query: BondQuery) {
  return useQuery({
    queryKey: ['bonds', query] as const,
    queryFn: () => bondService.list(query),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}
