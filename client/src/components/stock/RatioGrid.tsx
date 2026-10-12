import { Card } from '@/components/ui';
import type { Fundamentals } from '@/types';
import { changeTone, formatMarketCap, formatMultiple, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { StatRow } from './StatRow';

interface RatioGridProps {
  fundamentals: Fundamentals | null | undefined;
  currency: string;
  loading?: boolean;
}

interface Group {
  title: string;
  caption: string;
  rows: Array<{ label: string; value: string; tone?: 'up' | 'down' | 'flat' }>;
}

export function RatioGrid({ fundamentals, currency, loading }: RatioGridProps) {
  const valuation = fundamentals?.valuation;
  const profitability = fundamentals?.profitability;
  const growth = fundamentals?.growth;
  const financials = fundamentals?.financials;
  const perShare = fundamentals?.perShare;
  const dividend = fundamentals?.dividend;
  const risk = fundamentals?.risk;

  const groups: Group[] = [
    {
      title: 'Valuation',
      caption: 'What the market is paying',
      rows: [
        { label: 'P/E', value: formatMultiple(valuation?.peRatio) },
        { label: 'PEG', value: formatMultiple(valuation?.pegRatio) },
        { label: 'P/B', value: formatMultiple(valuation?.priceToBook) },
        { label: 'P/S', value: formatMultiple(valuation?.priceToSales) },
        { label: 'EV/EBITDA', value: formatMultiple(valuation?.evToEbitda) },
      ],
    },
    {
      title: 'Profitability',
      caption: 'What the business earns',
      rows: [
        { label: 'ROE', value: formatRate(profitability?.roe) },
        { label: 'ROA', value: formatRate(profitability?.roa) },
        { label: 'Gross margin', value: formatRate(profitability?.grossMargin) },
        { label: 'Operating margin', value: formatRate(profitability?.operatingMargin) },
        { label: 'Net margin', value: formatRate(profitability?.netMargin) },
      ],
    },
    {
      title: 'Growth & shareholder return',
      caption: 'Year on year, and what comes back to you',
      rows: [
        {
          label: 'Revenue growth',
          value: formatPercent(growth?.revenueGrowth),
          tone: changeTone(growth?.revenueGrowth),
        },
        {
          label: 'Earnings growth',
          value: formatPercent(growth?.earningsGrowth),
          tone: changeTone(growth?.earningsGrowth),
        },
        { label: 'EPS', value: perShare?.eps ? formatNumber(perShare.eps) : '—' },
        { label: 'Book value', value: perShare?.bookValue ? formatNumber(perShare.bookValue) : '—' },
        { label: 'Dividend yield', value: formatRate(dividend?.yield) },
        { label: 'Payout ratio', value: formatRate(dividend?.payoutRatio) },
      ],
    },
    {
      title: 'Balance sheet & risk',
      caption: 'What it owns, owes and how much it swings',
      rows: [
        { label: 'Revenue', value: formatMarketCap(financials?.revenue, currency) },
        { label: 'Net income', value: formatMarketCap(financials?.netIncome, currency) },
        { label: 'Total debt', value: formatMarketCap(financials?.totalDebt, currency) },
        { label: 'Total cash', value: formatMarketCap(financials?.totalCash, currency) },
        { label: 'Debt/Equity', value: formatMultiple(risk?.debtToEquity) },
        { label: 'Current ratio', value: formatMultiple(risk?.currentRatio) },
        { label: 'Interest coverage', value: formatMultiple(risk?.interestCoverage) },
        { label: 'Beta', value: formatNumber(risk?.beta) },
      ],
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.title} className="p-5 sm:p-6">
          <div className="mb-3">
            <h3 className="text-base font-semibold">{group.title}</h3>
            <p className="text-xs text-content-subtle">{group.caption}</p>
          </div>
          <dl className="divide-y divide-hairline">
            {group.rows.map((row) => (
              <StatRow key={row.label} label={row.label} value={row.value} tone={row.tone} loading={loading} />
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
