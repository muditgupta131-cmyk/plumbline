import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Card, Skeleton } from '@/components/ui';
import { RangeTabs } from '@/components/market';
import { paletteColor } from '@/components/portfolio';
import { queryKeys } from '@/lib/queryClient';
import { marketService } from '@/services';
import { securityKey, type CandleRange, type SecurityRef } from '@/types';
import { formatDate } from '@/utils/format';

interface IndexedChartProps {
  refs: SecurityRef[];
  range: CandleRange;
  onRangeChange: (range: CandleRange) => void;
}

interface Point {
  t: string;
  [symbol: string]: string | number;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass space-y-1 rounded-xl px-3 py-2 shadow-card">
      <p className="text-xs text-content-subtle">{formatDate(String(label))}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: entry.color }} aria-hidden />
          <span className="text-content-muted">{entry.dataKey}</span>
          <span data-numeric className="ml-auto font-medium">
            {entry.value === undefined ? '—' : `${(entry.value as number) >= 100 ? '+' : ''}${((entry.value as number) - 100).toFixed(1)}%`}
          </span>
        </p>
      ))}
    </div>
  );
}

export function IndexedChart({ refs, range, onRangeChange }: IndexedChartProps) {
  const results = useQueries({
    queries: refs.map((ref) => ({
      queryKey: queryKeys.candles(securityKey(ref), range),
      queryFn: () => marketService.candles(ref, range),
      staleTime: 60_000,
    })),
  });

  const loading = results.some((result) => result.isPending);

  const data = useMemo<Point[]>(() => {
    const series = results
      .map((result, index) => ({ symbol: refs[index]?.symbol, candles: result.data?.candles ?? [] }))
      .filter((entry) => entry.symbol && entry.candles.length > 1);

    if (!series.length) return [];

    const longest = series.reduce((best, entry) => (entry.candles.length > best.candles.length ? entry : best));

    return longest.candles.map((candle, index) => {
      const point: Point = { t: candle.t };

      for (const entry of series) {
        const base = entry.candles[0].c;
        const at = entry.candles[Math.min(index, entry.candles.length - 1)];
        if (base > 0) point[entry.symbol!] = Math.round((at.c / base) * 100 * 100) / 100;
      }

      return point;
    });
  }, [results, refs]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Relative performance</h3>
          <p className="text-xs text-content-subtle">Every line starts at 100, so the gap is the difference in return</p>
        </div>
        <RangeTabs value={range} onChange={onRangeChange} />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : data.length ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickFormatter={(value: string) => formatDate(value)}
                tick={{ fill: 'rgb(var(--color-content-subtle))', fontSize: 11 }}
              />
              <YAxis hide domain={['dataMin - 4', 'dataMax + 4']} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgb(var(--color-content-subtle))', strokeDasharray: '3 3' }} />
              {refs.map((ref, index) => (
                <Line
                  key={securityKey(ref)}
                  type="monotone"
                  dataKey={ref.symbol}
                  stroke={paletteColor(index)}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-content-subtle">No overlapping price history for these companies.</p>
      )}

      <ul className="mt-4 flex flex-wrap gap-4">
        {refs.map((ref, index) => (
          <li key={securityKey(ref)} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: paletteColor(index) }} aria-hidden />
            <span data-numeric>{ref.symbol}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
