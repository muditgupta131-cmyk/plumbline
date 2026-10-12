import { http } from './httpClient';
import type { IpoDetail, IpoList } from '@/types';

export const ipoService = {
  list: () => http.get<IpoList>('/ipo'),
  detail: (slug: string) => http.get<IpoDetail>(`/ipo/${encodeURIComponent(slug)}`),
};
