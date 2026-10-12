import type { Exchange } from '@/types';
import { cn } from '@/utils/cn';

const tones: Record<Exchange, string> = {
  NSE: 'bg-brand-600/10 text-brand-700 dark:text-brand-400',
  BSE: 'bg-brand-600/10 text-brand-700 dark:text-brand-400',
  NASDAQ: 'bg-accent-600/10 text-accent-600 dark:text-accent-400',
  NYSE: 'bg-accent-600/10 text-accent-600 dark:text-accent-400',
  AMEX: 'bg-accent-600/10 text-accent-600 dark:text-accent-400',
};

export function ExchangePill({ exchange, className }: { exchange: Exchange; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tones[exchange],
        className,
      )}
    >
      {exchange}
    </span>
  );
}
