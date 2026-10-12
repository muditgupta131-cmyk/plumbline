import type { ComparisonEntry } from '@/types';
import { formatCurrency, formatMarketCap, formatMultiple, formatNumber, formatPercent, formatRate } from '@/utils/format';

export type Direction = 'higher' | 'lower' | 'none';

export interface MetricRow {
  label: string;
  direction: Direction;
  value: (entry: ComparisonEntry) => number | null;
  format: (entry: ComparisonEntry) => string;
}

export interface MetricGroup {
  title: string;
  caption: string;
  rows: MetricRow[];
}

const price = (entry: ComparisonEntry, value: number | null | undefined) =>
  value === null || value === undefined ? '—' : formatCurrency(value, entry.currency);

export const METRIC_GROUPS: MetricGroup[] = [
  {
    title: 'Size and price',
    caption: 'What you pay and how big it is',
    rows: [
      {
        label: 'Price',
        direction: 'none',
        value: (entry) => entry.quote.price,
        format: (entry) => price(entry, entry.quote.price),
      },
      {
        label: 'Today',
        direction: 'higher',
        value: (entry) => entry.quote.changePercent,
        format: (entry) => formatPercent(entry.quote.changePercent),
      },
      {
        label: 'Market cap',
        direction: 'none',
        // Same precedence as the stock page: the quote first, then the exchange's reported figure.
        value: (entry) => entry.quote.marketCap ?? entry.fundamentals?.marketCap ?? null,
        format: (entry) => formatMarketCap(entry.quote.marketCap ?? entry.fundamentals?.marketCap, entry.currency),
      },
      {
        label: '52 week position',
        direction: 'lower',
        value: (entry) => {
          const { price: last, week52High, week52Low } = entry.quote;
          if (week52High === null || week52Low === null || week52High <= week52Low) return null;
          return ((last - week52Low) / (week52High - week52Low)) * 100;
        },
        format: (entry) => {
          const { price: last, week52High, week52Low } = entry.quote;
          if (week52High === null || week52Low === null || week52High <= week52Low) return '—';
          return `${(((last - week52Low) / (week52High - week52Low)) * 100).toFixed(0)}% of range`;
        },
      },
    ],
  },
  {
    title: 'Valuation',
    caption: 'Lower is cheaper, not necessarily better',
    rows: [
      { label: 'P/E', direction: 'lower', value: (e) => e.fundamentals?.valuation.peRatio ?? null, format: (e) => formatMultiple(e.fundamentals?.valuation.peRatio) },
      { label: 'PEG', direction: 'lower', value: (e) => e.fundamentals?.valuation.pegRatio ?? null, format: (e) => formatMultiple(e.fundamentals?.valuation.pegRatio) },
      { label: 'P/B', direction: 'lower', value: (e) => e.fundamentals?.valuation.priceToBook ?? null, format: (e) => formatMultiple(e.fundamentals?.valuation.priceToBook) },
      { label: 'P/S', direction: 'lower', value: (e) => e.fundamentals?.valuation.priceToSales ?? null, format: (e) => formatMultiple(e.fundamentals?.valuation.priceToSales) },
      { label: 'EV/EBITDA', direction: 'lower', value: (e) => e.fundamentals?.valuation.evToEbitda ?? null, format: (e) => formatMultiple(e.fundamentals?.valuation.evToEbitda) },
    ],
  },
  {
    title: 'Profitability',
    caption: 'What the business earns on what it uses',
    rows: [
      { label: 'ROE', direction: 'higher', value: (e) => e.fundamentals?.profitability.roe ?? null, format: (e) => formatRate(e.fundamentals?.profitability.roe) },
      { label: 'ROA', direction: 'higher', value: (e) => e.fundamentals?.profitability.roa ?? null, format: (e) => formatRate(e.fundamentals?.profitability.roa) },
      { label: 'Gross margin', direction: 'higher', value: (e) => e.fundamentals?.profitability.grossMargin ?? null, format: (e) => formatRate(e.fundamentals?.profitability.grossMargin) },
      { label: 'Operating margin', direction: 'higher', value: (e) => e.fundamentals?.profitability.operatingMargin ?? null, format: (e) => formatRate(e.fundamentals?.profitability.operatingMargin) },
      { label: 'Net margin', direction: 'higher', value: (e) => e.fundamentals?.profitability.netMargin ?? null, format: (e) => formatRate(e.fundamentals?.profitability.netMargin) },
    ],
  },
  {
    title: 'Growth',
    caption: 'Year on year',
    rows: [
      { label: 'Revenue growth', direction: 'higher', value: (e) => e.fundamentals?.growth.revenueGrowth ?? null, format: (e) => formatPercent(e.fundamentals?.growth.revenueGrowth) },
      { label: 'Earnings growth', direction: 'higher', value: (e) => e.fundamentals?.growth.earningsGrowth ?? null, format: (e) => formatPercent(e.fundamentals?.growth.earningsGrowth) },
    ],
  },
  {
    title: 'Balance sheet and risk',
    caption: 'What it owes and how hard it swings',
    rows: [
      { label: 'Revenue', direction: 'none', value: (e) => e.fundamentals?.financials.revenue ?? null, format: (e) => formatMarketCap(e.fundamentals?.financials.revenue ?? null, e.currency) },
      { label: 'Net income', direction: 'none', value: (e) => e.fundamentals?.financials.netIncome ?? null, format: (e) => formatMarketCap(e.fundamentals?.financials.netIncome ?? null, e.currency) },
      { label: 'Debt/Equity', direction: 'lower', value: (e) => e.fundamentals?.risk.debtToEquity ?? null, format: (e) => formatMultiple(e.fundamentals?.risk.debtToEquity) },
      { label: 'Current ratio', direction: 'higher', value: (e) => e.fundamentals?.risk.currentRatio ?? null, format: (e) => formatMultiple(e.fundamentals?.risk.currentRatio) },
      { label: 'Interest coverage', direction: 'higher', value: (e) => e.fundamentals?.risk.interestCoverage ?? null, format: (e) => formatMultiple(e.fundamentals?.risk.interestCoverage) },
      { label: 'Beta', direction: 'lower', value: (e) => e.fundamentals?.risk.beta ?? null, format: (e) => formatNumber(e.fundamentals?.risk.beta) },
    ],
  },
  {
    title: 'Shareholder return',
    caption: 'What comes back to you',
    rows: [
      { label: 'EPS', direction: 'none', value: (e) => e.fundamentals?.perShare.eps ?? null, format: (e) => (e.fundamentals?.perShare.eps ? formatNumber(e.fundamentals.perShare.eps) : '—') },
      { label: 'Dividend yield', direction: 'higher', value: (e) => e.fundamentals?.dividend.yield ?? null, format: (e) => formatRate(e.fundamentals?.dividend.yield) },
      { label: 'Payout ratio', direction: 'none', value: (e) => e.fundamentals?.dividend.payoutRatio ?? null, format: (e) => formatRate(e.fundamentals?.dividend.payoutRatio) },
    ],
  },
];

export function bestIndex(row: MetricRow, entries: ComparisonEntry[]): number | null {
  if (row.direction === 'none') return null;

  const values = entries.map((entry) => row.value(entry));
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length < 2) return null;

  const target = row.direction === 'higher' ? Math.max(...present) : Math.min(...present);
  const index = values.findIndex((value) => value === target);

  // A tie across every column tells the reader nothing.
  return values.filter((value) => value === target).length === values.length ? null : index;
}
