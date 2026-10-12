import type { ScoreBreakdown } from '@/types';
import { cn } from '@/utils/cn';

const LABELS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: 'valuation', label: 'Valuation' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'growth', label: 'Growth' },
  { key: 'balanceSheet', label: 'Balance sheet' },
  { key: 'momentum', label: 'Momentum' },
];

function tone(score: number): string {
  if (score >= 70) return 'bg-bull';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-bear';
}

export function ScoreBreakdownBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <dl className="space-y-2.5">
      {LABELS.map((item) => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <dt className="text-content-muted">{item.label}</dt>
            <dd data-numeric className="font-medium">
              {breakdown[item.key]}
            </dd>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-content/[0.06]">
            <div
              style={{ width: `${breakdown[item.key]}%` }}
              className={cn('h-full rounded-full transition-[width] duration-700 ease-swift', tone(breakdown[item.key]))}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
