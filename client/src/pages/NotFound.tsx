import { ButtonLink } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-5 py-20 text-center">
      <p data-numeric className="text-display-xl text-brand-600 dark:text-brand-400">
        404
      </p>
      <h1 className="text-display-md">That page isn&apos;t here</h1>
      <p className="max-w-md text-content-muted">
        The link may be outdated, or the ticker you followed no longer exists. Start from the markets overview.
      </p>
      <div className="flex gap-3">
        <ButtonLink to="/">Go to home</ButtonLink>
        <ButtonLink to="/markets" variant="secondary">
          Open markets
        </ButtonLink>
      </div>
    </div>
  );
}
