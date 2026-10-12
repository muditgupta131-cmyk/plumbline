import { useId, useMemo } from 'react';
import type { Candle } from '@/types';
import { cn } from '@/utils/cn';

interface SparklineProps {
  candles: Candle[];
  tone?: 'up' | 'down' | 'flat';
  className?: string;
  width?: number;
  height?: number;
}

const TONE_VAR: Record<'up' | 'down' | 'flat', string> = {
  up: 'rgb(var(--color-bull))',
  down: 'rgb(var(--color-bear))',
  flat: 'rgb(var(--color-content-subtle))',
};

export function Sparkline({ candles, tone = 'flat', className, width = 120, height = 36 }: SparklineProps) {
  const gradientId = useId();

  const geometry = useMemo(() => {
    const values = candles.map((candle) => candle.c).filter((value) => Number.isFinite(value));
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);

    const points = values.map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return {
      line: `M${points.join('L')}`,
      area: `M0,${height} L${points.join('L')} L${width},${height} Z`,
    };
  }, [candles, width, height]);

  if (!geometry) return <div className={cn('h-9 w-[120px]', className)} aria-hidden />;

  const color = TONE_VAR[tone];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-9 w-[120px] overflow-visible', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={geometry.area} fill={`url(#${gradientId})`} />
      <path d={geometry.line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
