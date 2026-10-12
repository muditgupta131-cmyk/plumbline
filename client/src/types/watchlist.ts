import type { AssetType, Currency, Exchange } from './market';

export const ALERT_TYPES = ['PRICE_ABOVE', 'PRICE_BELOW', 'PERCENT_MOVE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface WatchedItem {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  name: string;
  sector: string | null;
  currency: Currency;
  price: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  navDate: string | null;
  priced: boolean;
  alerts: number;
  notes?: string;
  addedAt: string;
}

export interface PriceAlert {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  name: string;
  type: AlertType;
  threshold: number;
  active: boolean;
  lastTriggeredAt?: string;
  lastValue?: number;
  triggerCount: number;
  note?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  kind: 'ALERT' | 'SYSTEM';
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface AlertEvaluation {
  checked: number;
  priced: number;
  triggered: number;
  skippedInCooldown: number;
}

export interface AddWatchPayload {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  notes?: string;
}

export interface CreateAlertPayload {
  itemId: string;
  type: AlertType;
  threshold: number;
  note?: string;
}
