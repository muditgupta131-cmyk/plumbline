import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui';
import { METRIC_HINTS, METRIC_LEARN_SLUGS } from './metricHints';
import { cn } from '@/utils/cn';

interface StatRowProps {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'flat';
  loading?: boolean;
}

export function StatRow({ label, value, tone = 'flat', loading }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-content-muted" title={METRIC_HINTS[label]}>
        {METRIC_LEARN_SLUGS[label] ? (
          <Link
            to={`/learn/${METRIC_LEARN_SLUGS[label]}`}
            className="decoration-dotted underline-offset-4 hover:text-content hover:underline"
          >
            {label}
          </Link>
        ) : (
          <span className={cn(METRIC_HINTS[label] && 'cursor-help decoration-dotted underline-offset-4 hover:underline')}>
            {label}
          </span>
        )}
      </dt>
      <dd
        data-numeric
        className={cn(
          'shrink-0 text-sm font-medium',
          tone === 'up' && 'text-bull',
          tone === 'down' && 'text-bear',
        )}
      >
        {loading ? <Skeleton rounded="sm" className="h-4 w-16" /> : value}
      </dd>
    </div>
  );
}
