import { useId } from 'react';
import { cn } from '@/utils/cn';

interface ScoreDialProps {
  score: number;
  label: string;
  size?: number;
  className?: string;
}

function toneFor(score: number): { stroke: string; text: string } {
  if (score >= 70) return { stroke: 'rgb(var(--color-bull))', text: 'text-bull' };
  if (score >= 50) return { stroke: '#F59E0B', text: 'text-amber-600 dark:text-amber-400' };
  return { stroke: 'rgb(var(--color-bear))', text: 'text-bear' };
}

export function ScoreDial({ score, label, size = 148, className }: ScoreDialProps) {
  const gradientId = useId();
  const tone = toneFor(score);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tone.stroke} stopOpacity="0.9" />
              <stop offset="100%" stopColor={tone.stroke} stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--color-content) / 0.08)"
            strokeWidth="10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className="transition-[stroke-dasharray] duration-700 ease-swift"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-numeric className={cn('text-3xl font-semibold', tone.text)}>
            {score}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-content-subtle">out of 100</span>
        </div>
      </div>

      <p className={cn('text-sm font-medium', tone.text)}>{label}</p>
    </div>
  );
}
