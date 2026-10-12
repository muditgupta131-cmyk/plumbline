import type { AssetType, Currency, Exchange, Market } from '../../types/market.js';

export interface HoldingInput {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
}

export interface ValuedHolding {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  fundHouse: string | null;
  navDate: string | null;
  market: Market;
  name: string;
  sector: string;
  currency: Currency;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
  notes?: string;
  price: number | null;
  dayChangePercent: number | null;
  investedLocal: number;
  valueLocal: number | null;
  invested: number;
  value: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  dayPnl: number | null;
  weight: number;
  holdingPeriodYears: number;
  cagr: number | null;
  annualDividend: number | null;
  fxRate: number;
  priced: boolean;
  priceSource: string | null;
  xirr: number | null;
  realisedGain: number | null;
  dividendsReceived: number | null;
  transactionCount: number;
}

export interface AllocationSlice {
  key: string;
  label: string;
  value: number;
  weight: number;
  pnl: number;
}

export interface PortfolioTotals {
  invested: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  dayPnl: number;
  dayPnlPercent: number;
  annualDividend: number;
  dividendYield: number;
  cagr: number | null;
  xirr: number | null;
  realisedGain: number;
  dividendsReceived: number;
  ledgerPositions: number;
  holdings: number;
  pricedHoldings: number;
  equityValue: number;
  fundValue: number;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  baseCurrency: Currency;
  isDefault: boolean;
  totals: PortfolioTotals;
  updatedAt: string;
}

export interface PortfolioValuation extends PortfolioSummary {
  holdings: ValuedHolding[];
  allocation: {
    byHolding: AllocationSlice[];
    bySector: AllocationSlice[];
    byMarket: AllocationSlice[];
    byExchange: AllocationSlice[];
    byAssetClass: AllocationSlice[];
  };
  unpricedSymbols: string[];
  asOf: string;
}

export interface PerformancePoint {
  t: string;
  value: number;
  invested: number;
}
