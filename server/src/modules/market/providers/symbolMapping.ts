import { EXCHANGE_MARKET, type Exchange, type SecurityRef } from '../../../types/market.js';

const YAHOO_SUFFIX: Partial<Record<Exchange, string>> = { NSE: '.NS', BSE: '.BO' };

export function toYahooSymbol(ref: SecurityRef): string {
  return `${ref.symbol.toUpperCase()}${YAHOO_SUFFIX[ref.exchange] ?? ''}`;
}

export function toAlphaVantageSymbol(ref: SecurityRef): string {
  if (EXCHANGE_MARKET[ref.exchange] === 'IN') return `${ref.symbol.toUpperCase()}.BSE`;
  return ref.symbol.toUpperCase();
}

export function fromYahooSymbol(raw: string, fallback: Exchange): SecurityRef {
  const value = raw.trim().toUpperCase();
  if (value.endsWith('.NS')) return { symbol: value.slice(0, -3), exchange: 'NSE' };
  if (value.endsWith('.BO')) return { symbol: value.slice(0, -3), exchange: 'BSE' };
  if (value.endsWith('.BSE')) return { symbol: value.slice(0, -4), exchange: 'BSE' };
  return { symbol: value.split('.')[0] ?? value, exchange: fallback };
}

const EXCHANGE_ALIASES: Record<string, Exchange> = {
  NSE: 'NSE',
  'NATIONAL STOCK EXCHANGE OF INDIA': 'NSE',
  NSI: 'NSE',
  BSE: 'BSE',
  'BOMBAY STOCK EXCHANGE': 'BSE',
  BOM: 'BSE',
  NASDAQ: 'NASDAQ',
  'NASDAQ GLOBAL SELECT': 'NASDAQ',
  'NASDAQ GLOBAL MARKET': 'NASDAQ',
  'NASDAQ CAPITAL MARKET': 'NASDAQ',
  NMS: 'NASDAQ',
  NYSE: 'NYSE',
  'NEW YORK STOCK EXCHANGE': 'NYSE',
  NYQ: 'NYSE',
  AMEX: 'AMEX',
  'NYSE AMERICAN': 'AMEX',
  ASE: 'AMEX',
};

export function normaliseExchange(raw: string | undefined | null): Exchange | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return EXCHANGE_ALIASES[key] ?? null;
}
