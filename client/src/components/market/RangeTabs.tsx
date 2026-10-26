import { CANDLE_RANGES, type CandleRange } from '@/types';
import { cn } from '@/utils/cn';

interface RangeTabsProps {
  value: CandleRange;
  onChange: (range: CandleRange) => void;
  className?: string;
}

export function RangeTabs({ value, onChange, className }: RangeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chart range"
      className={cn('inset-well flex items-center gap-1 rounded-full bg-canvas p-1', className)}
    >
      {CANDLE_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="tab"
          aria-selected={range === value}
          onClick={() => onChange(range)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200',
            range === value
              ? 'relief bg-elevated font-semibold text-brand-600 dark:text-brand-400'
              : 'text-content-subtle hover:text-content',
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
