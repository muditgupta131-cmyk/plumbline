import { Skeleton } from '@/components/ui';

export function PageLoader() {
  return (
    <div className="container space-y-6 py-16" role="status" aria-label="Loading page">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    </div>
  );
}
