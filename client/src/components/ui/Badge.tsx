import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'bull' | 'bear' | 'accent' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-content/[0.06] text-content-muted',
  bull: 'bg-bull/12 text-bull',
  bear: 'bg-bear/12 text-bear',
  accent: 'bg-accent-600/12 text-accent-600 dark:text-accent-400',
  brand: 'bg-brand-600/12 text-brand-600 dark:text-brand-400',
};

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
