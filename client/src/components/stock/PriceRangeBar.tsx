import { formatCurrency } from '@/utils/format';

interface PriceRangeBarProps {
  label: string;
  low: number | null;
  high: number | null;
  current: number;
  currency: string;
}

export function PriceRangeBar({ label, low, high, current, currency }: PriceRangeBarProps) {
  if (low === null || high === null || high <= low) return null;

  const position = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-content-subtle">{label}</span>
        <span data-numeric className="font-medium">
          {position.toFixed(0)}% of range
        </span>
      </div>

      <div
        className="relative h-1.5 rounded-full bg-gradient-to-r from-bear/40 via-content/10 to-bull/40"
        role="img"
        aria-label={`${label}: ${formatCurrency(low, currency)} to ${formatCurrency(high, currency)}, currently ${formatCurrency(current, currency)}`}
      >
        <span
          style={{ left: `${position}%` }}
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-content shadow"
        />
      </div>

      <div className="flex justify-between text-xs text-content-subtle">
        <span data-numeric>{formatCurrency(low, currency)}</span>
        <span data-numeric>{formatCurrency(high, currency)}</span>
      </div>
    </div>
  );
}
