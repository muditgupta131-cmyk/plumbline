import { http } from './httpClient';
import type { BondQuery, BondResponse } from '@/types';

export const bondService = {
  list: (query: BondQuery) =>
    http.get<BondResponse>('/bonds', {
      params: Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== null),
      ),
    }),
};
