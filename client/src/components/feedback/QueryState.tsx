import type { ReactNode } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { ApiError } from '@/services';
import { Button } from '@/components/ui';

interface QueryErrorProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function QueryError({ error, onRetry, className }: QueryErrorProps) {
  const isNetwork = error instanceof ApiError && error.isNetworkError;
  const message =
    error instanceof ApiError ? error.message : 'The data could not be loaded. Retry in a moment.';

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline p-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-bear/12 text-bear">
          {isNetwork ? <WifiOff className="size-5" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}
        </span>
        <p className="max-w-sm text-sm text-content-muted">{message}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline p-10 text-center">
      {icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-600/10 text-brand-600 dark:text-brand-400">
          {icon}
        </span>
      ) : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-content-muted">{description}</p>
      {action}
    </div>
  );
}
