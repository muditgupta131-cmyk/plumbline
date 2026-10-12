import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, type TooltipProps } from 'recharts';
import { Card, Skeleton } from '@/components/ui';
import type { AnnualFigure } from '@/types';
import { formatMarketCap } from '@/utils/format';

interface FinancialTrendProps {
  annual: AnnualFigure[] | undefined;
  currency: string;
  loading?: boolean;
}

function TrendTooltip({ active, payload, label, currency }: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass rounded-xl px-3 py-2 shadow-card">
      <p className="mb-1 text-xs font-semibold">FY {label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: entry.color }} aria-hidden />
          <span className="text-content-muted">{entry.dataKey === 'revenue' ? 'Revenue' : 'Net income'}</span>
          <span data-numeric className="ml-auto font-medium">
            {formatMarketCap(entry.value ?? null, currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function FinancialTrend({ annual, currency, loading }: FinancialTrendProps) {
  if (loading) {
    return (
      <Card className="p-5 sm:p-6">
        <Skeleton className="h-56 w-full" />
      </Card>
    );
  }

  if (!annual?.length) return null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Revenue and profit</h3>
          <p className="text-xs text-content-subtle">Last {annual.length} reported years</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-content-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent-600" aria-hidden /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand-600" aria-hidden /> Net income
          </span>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={annual} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgb(var(--color-hairline))" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgb(var(--color-content-subtle))', fontSize: 11 }}
            />
            <Tooltip
              content={<TrendTooltip currency={currency} />}
              cursor={{ fill: 'rgb(var(--color-content) / 0.04)' }}
            />
            <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="netIncome" fill="#16A34A" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
