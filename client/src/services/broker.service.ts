import { http } from './httpClient';
import type { BrokerCatalogue, BrokerConnectionSummary, BrokerId, BrokerSyncResult } from '@/types';

export const brokerService = {
  catalogue: () => http.get<BrokerCatalogue>('/brokers'),

  connections: () => http.get<{ connections: BrokerConnectionSummary[] }>('/brokers/connections'),

  connect: (broker: BrokerId, credentials: Record<string, string>) =>
    http.post<{ connection: BrokerConnectionSummary; holdings: number }>('/brokers/connections', {
      broker,
      credentials,
    }),

  disconnect: (id: string) => http.delete<null>(`/brokers/connections/${id}`),

  sync: (id: string, portfolioId: string) =>
    http.post<BrokerSyncResult>(`/brokers/connections/${id}/sync`, { portfolioId }),
};
