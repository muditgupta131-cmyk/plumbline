import type { Exchange } from '../../../types/market.js';

export const BROKER_IDS = ['groww', 'zerodha', 'upstox', 'dhan'] as const;
export type BrokerId = (typeof BROKER_IDS)[number];

export interface CredentialField {
  key: string;
  label: string;
  help: string;
  secret: boolean;
}

export interface BrokerHolding {
  symbol: string;
  exchange: Exchange;
  quantity: number;
  avgBuyPrice: number;
  isin?: string;
  name?: string;
}

export interface BrokerAdapter {
  id: BrokerId;
  label: string;
  country: 'IN';
  docsUrl: string;
  setupSteps: string[];
  credentialFields: CredentialField[];
  fetchHoldings(credentials: Record<string, string>): Promise<BrokerHolding[]>;
}

export function readExchange(value: unknown, fallback: Exchange = 'NSE'): Exchange {
  const raw = String(value ?? '').toUpperCase();
  if (raw.includes('BSE')) return 'BSE';
  if (raw.includes('NSE')) return 'NSE';
  return fallback;
}

export function readNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : 0;
}
