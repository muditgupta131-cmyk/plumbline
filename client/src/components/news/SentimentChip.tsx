import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Sentiment } from '@/types';
import { cn } from '@/utils/cn';

const TONES = {
  positive: { label: 'Positive', icon: TrendingUp, className: 'bg-bull/12 text-bull' },
  negative: { label: 'Negative', icon: TrendingDown, className: 'bg-bear/12 text-bear' },
  neutral: { label: 'Neutral', icon: Minus, className: 'bg-content/[0.06] text-content-muted' },
} as const;

interface SentimentChipProps {
  sentiment: Sentiment;
  keywordBased?: boolean;
  className?: string;
}

export function SentimentChip({ sentiment, keywordBased = true, className }: SentimentChipProps) {
  const tone = TONES[sentiment];

  return (
    <span
      title={keywordBased ? 'Scored from headline keywords, not a language model' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone.className,
        className,
      )}
    >
      <tone.icon className="size-3" aria-hidden />
      {tone.label}
    </span>
  );
}
