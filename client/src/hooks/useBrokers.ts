import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { brokerService } from '@/services';
import type { BrokerId } from '@/types';

export function useBrokerCatalogue() {
  return useQuery({
    queryKey: queryKeys.brokerCatalogue,
    queryFn: brokerService.catalogue,
    staleTime: 30 * 60_000,
  });
}

export function useBrokerConnections(enabled = true) {
  return useQuery({
    queryKey: queryKeys.brokerConnections,
    queryFn: brokerService.connections,
    enabled,
    staleTime: 60_000,
  });
}

export function useBrokerMutations(portfolioId: string | null) {
  const queryClient = useQueryClient();

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.brokerConnections }),
      queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
    ]);
  };

  const connect = useMutation({
    mutationFn: ({ broker, credentials }: { broker: BrokerId; credentials: Record<string, string> }) =>
      brokerService.connect(broker, credentials),
    onSuccess: refresh,
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => brokerService.disconnect(id),
    onSuccess: refresh,
  });

  const sync = useMutation({
    mutationFn: (id: string) => brokerService.sync(id, portfolioId!),
    onSuccess: refresh,
  });

  return { connect, disconnect, sync };
}
