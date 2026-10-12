import { http } from './httpClient';
import type { HealthStatus } from '@/types';

export const systemService = {
  health: () => http.get<HealthStatus>('/health'),
};
