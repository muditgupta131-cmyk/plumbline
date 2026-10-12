import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { portfolioService } from '@/services';
import type {
  CandleRange,
  CreateHoldingPayload,
  CreatePortfolioPayload,
  CreateTransactionPayload,
  UpdateHoldingPayload,
} from '@/types';

export function usePortfolios() {
  return useQuery({
    queryKey: queryKeys.portfolios,
    queryFn: portfolioService.list,
    staleTime: 30_000,
  });
}

export function usePortfolio(id: string | null) {
  return useQuery({
    queryKey: queryKeys.portfolio(id ?? 'none'),
    queryFn: () => portfolioService.detail(id!),
    enabled: Boolean(id),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function usePortfolioPerformance(id: string | null, range: CandleRange) {
  return useQuery({
    queryKey: queryKeys.portfolioPerformance(id ?? 'none', range),
    queryFn: () => portfolioService.performance(id!, range),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useTransactions(id: string | null) {
  return useQuery({
    queryKey: queryKeys.portfolioTransactions(id ?? 'none'),
    queryFn: () => portfolioService.transactions(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function usePortfolioMutations(portfolioId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolios }),
      portfolioId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.portfolio(portfolioId) })
        : Promise.resolve(),
      portfolioId
        ? queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance', portfolioId] })
        : Promise.resolve(),
      portfolioId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.portfolioTransactions(portfolioId) })
        : Promise.resolve(),
    ]);
  };

  const createPortfolio = useMutation({
    mutationFn: (payload: CreatePortfolioPayload) => portfolioService.create(payload),
    onSuccess: invalidate,
  });

  const deletePortfolio = useMutation({
    mutationFn: (id: string) => portfolioService.remove(id),
    onSuccess: invalidate,
  });

  const addHolding = useMutation({
    mutationFn: (payload: CreateHoldingPayload) => portfolioService.addHolding(portfolioId!, payload),
    onSuccess: invalidate,
  });

  const updateHolding = useMutation({
    mutationFn: ({ holdingId, payload }: { holdingId: string; payload: UpdateHoldingPayload }) =>
      portfolioService.updateHolding(portfolioId!, holdingId, payload),
    onSuccess: invalidate,
  });

  const removeHolding = useMutation({
    mutationFn: (holdingId: string) => portfolioService.removeHolding(portfolioId!, holdingId),
    onSuccess: invalidate,
  });

  const addTransaction = useMutation({
    mutationFn: (payload: CreateTransactionPayload) => portfolioService.addTransaction(portfolioId!, payload),
    onSuccess: invalidate,
  });

  const removeTransaction = useMutation({
    mutationFn: (transactionId: string) => portfolioService.removeTransaction(portfolioId!, transactionId),
    onSuccess: invalidate,
  });

  return {
    createPortfolio,
    deletePortfolio,
    addHolding,
    updateHolding,
    removeHolding,
    addTransaction,
    removeTransaction,
  };
}
