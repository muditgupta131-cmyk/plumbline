import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { watchlistService } from '@/services';
import type { AddWatchPayload, CreateAlertPayload } from '@/types';

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: watchlistService.list,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.watchlistAlerts,
    queryFn: watchlistService.alerts,
    staleTime: 30_000,
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: watchlistService.notifications,
    enabled,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });
}

export function useWatchlistMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlistAlerts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    ]);
  };

  return {
    add: useMutation({ mutationFn: (payload: AddWatchPayload) => watchlistService.add(payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => watchlistService.remove(id), onSuccess: invalidate }),
    createAlert: useMutation({
      mutationFn: (payload: CreateAlertPayload) => watchlistService.createAlert(payload),
      onSuccess: invalidate,
    }),
    toggleAlert: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) => watchlistService.setAlertActive(id, active),
      onSuccess: invalidate,
    }),
    removeAlert: useMutation({ mutationFn: (id: string) => watchlistService.removeAlert(id), onSuccess: invalidate }),
    evaluate: useMutation({ mutationFn: () => watchlistService.evaluate(), onSuccess: invalidate }),
    markRead: useMutation({ mutationFn: (id: string) => watchlistService.markRead(id), onSuccess: invalidate }),
    markAllRead: useMutation({ mutationFn: () => watchlistService.markAllRead(), onSuccess: invalidate }),
  };
}
