import { http } from './httpClient';
import type {
  AddWatchPayload,
  AlertEvaluation,
  AppNotification,
  CreateAlertPayload,
  PriceAlert,
  WatchedItem,
} from '@/types';

export const watchlistService = {
  list: () => http.get<{ items: WatchedItem[] }>('/watchlist'),

  add: (payload: AddWatchPayload) => http.post<WatchedItem>('/watchlist', payload),

  remove: (id: string) => http.delete<null>(`/watchlist/${id}`),

  alerts: () => http.get<{ alerts: PriceAlert[] }>('/watchlist/alerts'),

  createAlert: (payload: CreateAlertPayload) => http.post<PriceAlert>('/watchlist/alerts', payload),

  setAlertActive: (id: string, active: boolean) => http.patch<PriceAlert>(`/watchlist/alerts/${id}`, { active }),

  removeAlert: (id: string) => http.delete<null>(`/watchlist/alerts/${id}`),

  evaluate: () => http.post<AlertEvaluation>('/watchlist/alerts/evaluate', {}),

  notifications: () => http.get<{ notifications: AppNotification[]; unread: number }>('/notifications'),

  markRead: (id: string) => http.patch<AppNotification>(`/notifications/${id}/read`, {}),

  markAllRead: () => http.patch<{ updated: number }>('/notifications/read-all', {}),
};
