import { http } from './httpClient';
import type { ScreenerQuery, ScreenerResponse } from '@/types';

export const screenerService = {
  screen: (query: ScreenerQuery) =>
    http.get<ScreenerResponse>('/screener', {
      params: Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== null),
      ),
    }),
};
