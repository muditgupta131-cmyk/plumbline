import type { CandleRange } from './stock';
import type { AssetType, Currency, Exchange, Market } from './market';
import type { SymbolMatch } from './stock';

export interface FundMatch {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  plan: string | null;
  option: string | null;
  isin: string | null;
  nav: number;
  navDate: string;
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

export const TRANSACTION_TYPES = ['BUY', 'SELL', 'DIVIDEND'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface PortfolioTransaction {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: Currency;
  date: string;
  notes?: string;
}

export interface CreateTransactionPayload {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees?: number;
  date: string;
  notes?: string;
}

export interface PositionState {
  quantity: number;
  avgBuyPrice: number;
  buyDate: string | null;
  realisedGain: number;
  dividends: number;
  invested: number;
  transactions: number;
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

export interface PerformanceResponse {
  range: CandleRange;
  points: PerformancePoint[];
}

export interface CreatePortfolioPayload {
  name: string;
  baseCurrency: Currency;
}

export interface CreateHoldingPayload {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
}

export interface UpdateHoldingPayload {
  quantity?: number;
  avgBuyPrice?: number;
  buyDate?: string;
  notes?: string;
}

export type MatchConfidence = 'exact' | 'symbol' | 'name' | 'none';

export interface ImportPreviewRow {
  line: number;
  symbol: string | null;
  name: string | null;
  isin: string | null;
  quantity: number | null;
  avgBuyPrice: number | null;
  exchange: Exchange | null;
  buyDate: string | null;
  assetType: AssetType;
  transactionType: TransactionType | null;
  amount: number | null;
  match: SymbolMatch | null;
  fund: FundMatch | null;
  confidence: MatchConfidence;
  issues: string[];
  suggestions: SymbolMatch[];
  fundSuggestions: FundMatch[];
  /** The position this row would land on, when the portfolio already holds it. */
  existing: { quantity: number; avgBuyPrice: number } | null;
  effect: RowEffect;
}

/** What committing a row would actually do. */
export type RowEffect = 'new' | 'update' | 'unchanged' | 'ledger';

export type ImportStrategy = 'add' | 'replace';

export type ImportMode = 'positions' | 'transactions';

export interface ImportPreview {
  mode: ImportMode;
  detectedFormat: string | null;
  totalRows: number;
  importable: number;
  rows: ImportPreviewRow[];
  notice: string | null;
  suggestedStrategy: ImportStrategy;
}

export interface ImportCommitTransaction {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees?: number;
  date: string;
}

export interface ImportCommitRow {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
}

export interface ImportResult {
  added: number;
  skipped: number;
  failed: Array<{ symbol: string; reason: string }>;
}

export type BrokerId = 'groww' | 'zerodha' | 'upstox' | 'dhan';

export interface BrokerCredentialField {
  key: string;
  label: string;
  help: string;
  secret: boolean;
}

export interface BrokerCatalogueEntry {
  id: BrokerId;
  label: string;
  docsUrl: string;
  setupSteps: string[];
  credentialFields: BrokerCredentialField[];
}

export interface BrokerCatalogue {
  available: boolean;
  note: string;
  brokers: BrokerCatalogueEntry[];
}

export interface BrokerConnectionSummary {
  id: string;
  broker: BrokerId;
  brokerLabel: string;
  label: string;
  hint: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  holdingsSynced: number;
}

export interface BrokerSyncResult {
  added: number;
  updated: number;
  removed: number;
  fetched: number;
  matched: number;
  discovered: string[];
  skipped: Array<{ symbol: string; reason: string }>;
  syncedAt: string;
}

export interface FundRow {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  plan: string | null;
  option: string | null;
  nav: number;
  navDate: string;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
}

export type FundSort = 'return1y' | 'return3y' | 'return5y' | 'nav' | 'name';

export interface FundExploreQuery {
  q?: string;
  category?: string;
  fundHouse?: string;
  plan?: 'Direct' | 'Regular';
  sort?: FundSort;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FundExploreResponse {
  funds: FundRow[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
  fundHouses: string[];
}

export type BondSegment = 'corporate' | 'gsec';

export interface BondRow {
  symbol: string;
  isin: string | null;
  couponRate: number | null;
  maturity: string | null;
  yearsToMaturity: number | null;
  creditRating: string | null;
  ratingAgency: string | null;
  ratingGrade: string | null;
  faceValue: number | null;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  volume: number | null;
  series: string | null;
  segment: BondSegment;
  tradedToday: boolean;
  currentYield: number | null;
  yieldToMaturity: number | null;
}

export type BondSort = 'yieldToMaturity' | 'currentYield' | 'couponRate' | 'yearsToMaturity' | 'symbol';

export interface BondQuery {
  q?: string;
  segment?: BondSegment;
  rating?: string;
  maturity?: 'under1' | '1to3' | '3to5' | '5to10' | 'over10';
  tradedOnly?: boolean;
  sort?: BondSort;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface BondResponse {
  bonds: BondRow[];
  total: number;
  page: number;
  limit: number;
  ratings: string[];
  counts: { corporate: number; gsec: number; tradedToday: number };
}

export interface FundNavPoint {
  t: string;
  nav: number;
}

export interface FundDetail extends FundMatch {
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  categoryRank: number | null;
  categorySize: number;
  categoryMedian3y: number | null;
}
