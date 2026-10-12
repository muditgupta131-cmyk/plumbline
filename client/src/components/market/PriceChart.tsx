import { useId, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis, type TooltipProps } from 'recharts';
import type { Candle, CandleRange } from '@/types';
import { Skeleton } from '@/components/ui';
import { formatCurrency } from '@/utils/format';

interface PriceChartProps {
  candles: Candle[];
  currency: string;
  range: CandleRange;
  tone: 'up' | 'down' | 'flat';
  loading?: boolean;
  height?: number;
}

const TONE_VAR = {
  up: 'rgb(var(--color-bull))',
  down: 'rgb(var(--color-bear))',
  flat: 'rgb(var(--color-content-subtle))',
} as const;

function formatStamp(value: string, range: CandleRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const intraday = range === '1D' || range === '1W';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    ...(intraday ? { hour: 'numeric', minute: '2-digit' } : { year: range === '5Y' ? 'numeric' : undefined }),
  }).format(date);
}

interface ChartPoint {
  t: string;
  c: number;
}

function ChartTooltip({ active, payload, currency, range }: TooltipProps<number, string> & { currency: string; range: CandleRange }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ChartPoint;

  return (
    <div className="glass rounded-xl px-3 py-2 shadow-card">
      <p data-numeric className="text-sm font-semibold">
        {formatCurrency(point.c, currency)}
      </p>
      <p className="text-[11px] text-content-subtle">{formatStamp(point.t, range)}</p>
    </div>
  );
}

export function PriceChart({ candles, currency, range, tone, loading, height = 220 }: PriceChartProps) {
  const gradientId = useId();

  const data = useMemo<ChartPoint[]>(() => candles.map((candle) => ({ t: candle.t, c: candle.c })), [candles]);

  const domain = useMemo<[number, number]>(() => {
    const values = data.map((point) => point.c);
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min || max * 0.02) * 0.12;
    return [min - padding, max + padding];
  }, [data]);

  if (loading) return <Skeleton className="w-full" style={{ height }} />;

  if (data.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl border border-dashed border-hairline text-sm text-content-subtle"
      >
        No price history for this range.
      </div>
    );
  }

  const color = TONE_VAR[tone];

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain} />
          <Tooltip
            content={<ChartTooltip currency={currency} range={range} />}
            cursor={{ stroke: 'rgb(var(--color-content-subtle))', strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey="c"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
