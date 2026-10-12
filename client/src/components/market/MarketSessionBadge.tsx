import type { ExchangeSession } from '@/types';
import { formatDuration } from '@/utils/format';
import { cn } from '@/utils/cn';

const TONES = {
  open: 'bg-bull/12 text-bull',
  'pre-open': 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  closed: 'bg-content/[0.06] text-content-muted',
} as const;

function label(session: ExchangeSession): string {
  if (session.status === 'open') return `Closes in ${formatDuration(session.closesInMinutes)}`;
  if (session.status === 'pre-open') return `Opens in ${formatDuration(session.opensInMinutes)}`;
  return `Opens in ${formatDuration(session.opensInMinutes)}`;
}

export function MarketSessionBadge({ session, className }: { session: ExchangeSession; className?: string }) {
  const isOpen = session.status === 'open';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
        TONES[session.status],
        className,
      )}
    >
      <span className="relative flex size-2">
        {isOpen ? (
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-bull" aria-hidden />
        ) : null}
        <span
          className={cn('relative inline-flex size-2 rounded-full', isOpen ? 'bg-bull' : 'bg-content-subtle')}
          aria-hidden
        />
      </span>
      <span className="font-semibold">{session.exchange}</span>
      <span className="text-content-subtle">
        {session.localTime} {session.timezone}
      </span>
      <span aria-hidden>·</span>
      {label(session)}
    </span>
  );
}
