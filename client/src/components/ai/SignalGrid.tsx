import { Check, Minus, TriangleAlert } from 'lucide-react';
import type { Signal } from '@/types';
import { cn } from '@/utils/cn';

const TONES = {
  strong: { chip: 'border-bull/30 bg-bull/[0.06]', icon: 'text-bull', Icon: Check },
  neutral: { chip: 'border-hairline', icon: 'text-content-subtle', Icon: Minus },
  weak: { chip: 'border-bear/30 bg-bear/[0.06]', icon: 'text-bear', Icon: TriangleAlert },
} as const;

export function SignalGrid({ signals }: { signals: Signal[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {signals.map((signal) => {
        const tone = TONES[signal.verdict];
        return (
          <li key={signal.id} className={cn('flex gap-2.5 rounded-xl border p-3', tone.chip)}>
            <tone.Icon className={cn('mt-0.5 size-4 shrink-0', tone.icon)} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">{signal.label}</p>
              <p className="text-xs leading-relaxed text-content-muted">{signal.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
