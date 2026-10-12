export const EXCHANGES = ['NSE', 'BSE', 'NASDAQ', 'NYSE', 'AMEX'] as const;
export type Exchange = (typeof EXCHANGES)[number];

export const MARKETS = ['IN', 'US'] as const;
export type Market = (typeof MARKETS)[number];

export const CURRENCIES = ['INR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const EXCHANGE_MARKET: Record<Exchange, Market> = {
  NSE: 'IN',
  BSE: 'IN',
  NASDAQ: 'US',
  NYSE: 'US',
  AMEX: 'US',
};

export const MARKET_CURRENCY: Record<Market, Currency> = {
  IN: 'INR',
  US: 'USD',
};

export const ASSET_TYPES = ['EQUITY', 'MUTUAL_FUND'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface SecurityRef {
  symbol: string;
  exchange: Exchange;
}

export function currencyForExchange(exchange: Exchange): Currency {
  return MARKET_CURRENCY[EXCHANGE_MARKET[exchange]];
}

export function securityKey(ref: SecurityRef): string {
  return `${ref.exchange}:${ref.symbol.toUpperCase()}`;
}

export function parseSecurityKey(key: string): SecurityRef | null {
  const [exchange, symbol] = key.split(':');
  if (!exchange || !symbol) return null;
  if (!EXCHANGES.includes(exchange as Exchange)) return null;
  return { exchange: exchange as Exchange, symbol: symbol.toUpperCase() };
}
