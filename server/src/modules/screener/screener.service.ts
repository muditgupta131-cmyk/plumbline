import { ApiError } from '../../utils/ApiError.js';
import { securityKey, type Currency, type Exchange, type Market, type SecurityRef } from '../../types/market.js';
import { cached } from '../market/market.cache.js';
import { getFundamentals, getQuotes } from '../market/market.service.js';
import { popularSymbols } from '../market/symbol.service.js';

const UNIVERSE_CAP = 60;
const DATASET_TTL = 15 * 60_000;
const FUNDAMENTALS_CONCURRENCY = 6;

export interface ScreenerRow {
  symbol: string;
  exchange: Exchange;
  market: Market;
  name: string;
  sector: string;
  industry: string | null;
  currency: Currency;
  price: number;
  changePercent: number;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  roe: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  revenue: number | null;
  rangePosition: number | null;
}

export const SORT_FIELDS = [
  'marketCap',
  'peRatio',
  'roe',
  'revenueGrowth',
  'dividendYield',
  'changePercent',
  'price',
  'netMargin',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface ScreenerFilters {
  market?: Market;
  sector?: string;
  minMarketCap?: number;
  maxPeRatio?: number;
  minPeRatio?: number;
  minRoe?: number;
  maxDebtToEquity?: number;
  minRevenueGrowth?: number;
  minDividendYield?: number;
  minPrice?: number;
  maxPrice?: number;
  maxRangePosition?: number;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  total: number;
  universe: number;
  sectors: string[];
  page: number;
  limit: number;
  truncated: boolean;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Screening needs fundamentals per company, which is one upstream call each. The universe is
 * therefore capped and the whole dataset cached, rather than fanning out on every keystroke.
 */
async function buildDataset(market: Market | undefined): Promise<ScreenerRow[]> {
  return cached(`screener:${market ?? 'all'}`, DATASET_TTL, async () => {
    const matches = await popularSymbols(market, UNIVERSE_CAP);
    if (!matches.length) return [];

    const refs: SecurityRef[] = matches.map((match) => ({ symbol: match.symbol, exchange: match.exchange }));
    const { quotes } = await getQuotes(refs);
    const quoteMap = new Map(quotes.map((quote) => [securityKey(quote), quote]));

    const rows = await mapWithConcurrency(matches, FUNDAMENTALS_CONCURRENCY, async (match) => {
      const key = securityKey(match);
      const quote = quoteMap.get(key);
      if (!quote) return null;

      const fundamentals = await getFundamentals({ symbol: match.symbol, exchange: match.exchange }).catch(() => null);

      const rangePosition =
        quote.week52High !== null && quote.week52Low !== null && quote.week52High > quote.week52Low
          ? Math.round(((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100)
          : null;

      return {
        symbol: match.symbol,
        exchange: match.exchange,
        market: match.market,
        name: match.name,
        sector: match.sector ?? 'Unclassified',
        industry: match.industry ?? null,
        currency: quote.currency,
        price: quote.price,
        changePercent: quote.changePercent,
        marketCap: quote.marketCap ?? null,
        peRatio: fundamentals?.valuation.peRatio ?? null,
        eps: fundamentals?.perShare.eps ?? null,
        roe: fundamentals?.profitability.roe ?? null,
        netMargin: fundamentals?.profitability.netMargin ?? null,
        revenueGrowth: fundamentals?.growth.revenueGrowth ?? null,
        debtToEquity: fundamentals?.risk.debtToEquity ?? null,
        dividendYield: fundamentals?.dividend.yield ?? null,
        revenue: fundamentals?.financials.revenue ?? null,
        rangePosition,
      } satisfies ScreenerRow;
    });

    // The universe carries the same company on more than one exchange. A screener should
    // list companies, so keep the most liquid listing and drop the secondary one.
    const preferred = new Map<string, ScreenerRow>();
    const rank: Record<string, number> = { NSE: 3, NASDAQ: 3, NYSE: 3, AMEX: 2, BSE: 1 };

    for (const row of rows) {
      if (!row) continue;
      const existing = preferred.get(row.symbol);
      if (!existing || (rank[row.exchange] ?? 0) > (rank[existing.exchange] ?? 0)) {
        preferred.set(row.symbol, row);
      }
    }

    return [...preferred.values()];
  });
}

function passes(row: ScreenerRow, filters: ScreenerFilters): boolean {
  const atLeast = (value: number | null, floor: number | undefined) =>
    floor === undefined || (value !== null && value >= floor);
  const atMost = (value: number | null, ceiling: number | undefined) =>
    ceiling === undefined || (value !== null && value <= ceiling);

  if (filters.sector && row.sector !== filters.sector) return false;

  return (
    atLeast(row.marketCap, filters.minMarketCap) &&
    atLeast(row.peRatio, filters.minPeRatio) &&
    atMost(row.peRatio, filters.maxPeRatio) &&
    atLeast(row.roe, filters.minRoe) &&
    atMost(row.debtToEquity, filters.maxDebtToEquity) &&
    atLeast(row.revenueGrowth, filters.minRevenueGrowth) &&
    atLeast(row.dividendYield, filters.minDividendYield) &&
    atLeast(row.price, filters.minPrice) &&
    atMost(row.price, filters.maxPrice) &&
    atMost(row.rangePosition, filters.maxRangePosition)
  );
}

export async function screen(filters: ScreenerFilters): Promise<ScreenerResponse> {
  if (filters.limit > 100) throw ApiError.badRequest('Ask for at most 100 rows at a time.');

  const dataset = await buildDataset(filters.market);
  const matched = dataset.filter((row) => passes(row, filters));

  const direction = filters.sortDir === 'asc' ? 1 : -1;
  matched.sort((a, b) => {
    const left = a[filters.sortBy];
    const right = b[filters.sortBy];

    // Rows missing the sorted metric sink to the bottom whichever way the sort runs.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    return (left - right) * direction;
  });

  const start = (filters.page - 1) * filters.limit;

  return {
    rows: matched.slice(start, start + filters.limit),
    total: matched.length,
    universe: dataset.length,
    sectors: [...new Set(dataset.map((row) => row.sector))].sort(),
    page: filters.page,
    limit: filters.limit,
    truncated: dataset.length >= UNIVERSE_CAP,
  };
}
