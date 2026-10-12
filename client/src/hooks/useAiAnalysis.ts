import { useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { aiService } from '@/services';
import { securityKey, type SecurityRef } from '@/types';

export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: aiService.status,
    staleTime: 10 * 60_000,
  });
}

export function usePortfolioAnalysis(portfolioId: string | null, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.aiPortfolioAnalysis(portfolioId ?? 'none'),
    queryFn: () => aiService.portfolioAnalysis(portfolioId!),
    enabled: Boolean(portfolioId) && enabled,
    staleTime: 60 * 60_000,
    retry: false,
  });

  const regenerate = async () => {
    if (!portfolioId) return;
    const fresh = await aiService.portfolioAnalysis(portfolioId, true);
    queryClient.setQueryData(queryKeys.aiPortfolioAnalysis(portfolioId), fresh);
  };

  return { ...query, regenerate };
}

export function useStockAnalysis(ref: SecurityRef | null, enabled: boolean) {
  const key = ref ? securityKey(ref) : 'none';

  const query = useQuery({
    queryKey: queryKeys.aiStockAnalysis(key),
    queryFn: () => aiService.stockAnalysis(ref!),
    enabled: Boolean(ref) && enabled,
    staleTime: 60 * 60_000,
    retry: false,
  });

  const regenerate = async () => {
    if (!ref) return;
    const fresh = await aiService.stockAnalysis(ref, true);
    queryClient.setQueryData(queryKeys.aiStockAnalysis(key), fresh);
  };

  return { ...query, regenerate };
}
