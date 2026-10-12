export type * from './api';
export type * from './auth';
export * from './market';
export * from './stock';
export * from './ai';
export * from './portfolio';
export * from './news';
export * from './watchlist';
export * from './screener';

export type Theme = 'light' | 'dark';

export type Trend = 'up' | 'down' | 'flat';

export interface NavItem {
  label: string;
  to: string;
  description?: string;
  requiresAuth?: boolean;
}
export * from './ipo';
