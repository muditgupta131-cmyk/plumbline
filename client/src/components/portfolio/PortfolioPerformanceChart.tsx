import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card, Skeleton } from '@/components/ui';
import { RangeTabs } from '@/components/market';
import type { CandleRange, PerformancePoint } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

interface PortfolioPerformanceChartProps {
  points: PerformancePoint[] | undefined;
  currency: string;
  range: CandleRange;
  onRangeChange: (range: CandleRange) => void;
  loading?: boolean;
}

function PerformanceTooltip({ active, payload, currency }: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as PerformancePoint;
  const pnl = point.value - point.invested;

  return (
    <div className="glass space-y-1 rounded-xl px-3 py-2 shadow-card">
      <p className="text-xs text-content-subtle">{formatDate(point.t)}</p>
      <p data-numeric className="text-sm font-semibold">
        {formatCurrency(point.value, currency, 0)}
      </p>
      <p data-numeric className="text-xs text-content-muted">
        Invested {formatCurrency(point.invested, currency, 0)} · {pnl >= 0 ? '+' : ''}
        {formatCurrency(pnl, currency, 0)}
      </p>
    </div>
  );
}

export function PortfolioPerformanceChart({
  points,
  currency,
  range,
  onRangeChange,
  loading,
}: PortfolioPerformanceChartProps) {
  const domain = useMemo<[number, number]>(() => {
    if (!points?.length) return [0, 1];
    const values = points.flatMap((point) => [point.value, point.invested]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min || max * 0.05) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [points]);

  const gaining = points?.length ? points[points.length - 1].value >= points[points.length - 1].invested : true;
  const color = gaining ? 'rgb(var(--color-bull))' : 'rgb(var(--color-bear))';

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Portfolio value</h3>
          <p className="text-xs text-content-subtle">Value against money invested</p>
        </div>
        <RangeTabs value={range} onChange={onRangeChange} />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : points?.length ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolio-value" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickFormatter={(value: string) => formatDate(value)}
                tick={{ fill: 'rgb(var(--color-content-subtle))', fontSize: 11 }}
              />
              <YAxis hide domain={domain} />
              <Tooltip
                content={<PerformanceTooltip currency={currency} />}
                cursor={{ stroke: 'rgb(var(--color-content-subtle))', strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill="url(#portfolio-value)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="rgb(var(--color-content-subtle))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-content-subtle">
          Add holdings to chart how the portfolio has moved.
        </p>
      )}
    </Card>
  );
}
