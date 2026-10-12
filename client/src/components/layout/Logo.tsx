import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Plumbline home">
      <span className="flex size-9 items-center justify-center rounded-xl bg-ink-900 dark:bg-brand-600">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path
            d="M7 21.5 13 14l4.5 4.5L25 9"
            fill="none"
            stroke="#16A34A"
            className="dark:stroke-white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="25" cy="9" r="3" fill="#16A34A" className="dark:fill-white" />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Invest<span className="text-brand-600 dark:text-brand-400">IQ</span>
      </span>
    </Link>
  );
}
