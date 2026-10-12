import type { Currency, Market } from '../types/market.js';

export interface IndexDefinition {
  id: string;
  name: string;
  short: string;
  market: Market;
  currency: Currency;
  providerSymbol: string;
  referenceValue: number;
}

export const INDEX_DEFINITIONS: IndexDefinition[] = [
  {
    id: 'NIFTY50',
    name: 'NIFTY 50',
    short: 'NIFTY',
    market: 'IN',
    currency: 'INR',
    providerSymbol: '^NSEI',
    referenceValue: 27_480,
  },
  {
    id: 'SENSEX',
    name: 'BSE SENSEX',
    short: 'SENSEX',
    market: 'IN',
    currency: 'INR',
    providerSymbol: '^BSESN',
    referenceValue: 89_640,
  },
  {
    id: 'BANKNIFTY',
    name: 'NIFTY Bank',
    short: 'BANKNIFTY',
    market: 'IN',
    currency: 'INR',
    providerSymbol: '^NSEBANK',
    referenceValue: 61_820,
  },
  {
    id: 'SP500',
    name: 'S&P 500',
    short: 'S&P 500',
    market: 'US',
    currency: 'USD',
    providerSymbol: '^GSPC',
    referenceValue: 6_840,
  },
  {
    id: 'NASDAQ',
    name: 'NASDAQ Composite',
    short: 'NASDAQ',
    market: 'US',
    currency: 'USD',
    providerSymbol: '^IXIC',
    referenceValue: 23_260,
  },
  {
    id: 'DOWJONES',
    name: 'Dow Jones Industrial Average',
    short: 'DOW',
    market: 'US',
    currency: 'USD',
    providerSymbol: '^DJI',
    referenceValue: 47_310,
  },
];

export const INDEX_BY_PROVIDER_SYMBOL = new Map(
  INDEX_DEFINITIONS.map((definition) => [definition.providerSymbol, definition]),
);
