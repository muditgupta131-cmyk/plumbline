import { useQuery } from '@tanstack/react-query';
import { ipoService } from '@/services';

// Subscription figures move through the day while a book is open, but not minute to minute.
const STALE_MS = 5 * 60_000;

export function useIpos() {
  return useQuery({
    queryKey: ['ipo', 'list'] as const,
    queryFn: () => ipoService.list(),
    staleTime: STALE_MS,
  });
}

export function useIpo(slug: string | null) {
  return useQuery({
    queryKey: ['ipo', 'detail', slug] as const,
    queryFn: () => ipoService.detail(slug!),
    enabled: Boolean(slug),
    staleTime: STALE_MS,
  });
}
