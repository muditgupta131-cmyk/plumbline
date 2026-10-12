import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { changeTone, formatPercent } from '@/utils/format';

interface DeltaProps {
  value: number | null | undefined;
  absolute?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function Delta({ value, absolute, size = 'sm', className }: DeltaProps) {
  const tone = changeTone(value);
  const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus;

  return (
    <span
      data-numeric
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        tone === 'up' && 'text-bull',
        tone === 'down' && 'text-bear',
        tone === 'flat' && 'text-content-subtle',
        size === 'sm' ? 'text-sm' : 'text-base',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      {formatPercent(value)}
      {absolute !== undefined && absolute !== null ? (
        <span className="text-content-subtle">({absolute > 0 ? '+' : ''}{absolute.toFixed(2)})</span>
      ) : null}
    </span>
  );
}
