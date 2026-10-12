import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Compass, Lightbulb, MapPin } from 'lucide-react';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { LEARN_ENTRIES, findEntry } from '@/content/learn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function LearnEntryPage() {
  const { slug = '' } = useParams();
  const entry = findEntry(slug);

  useDocumentTitle(entry ? entry.title : 'Not found', entry?.oneLiner);

  if (!entry) {
    return (
      <div className="container py-20">
        <EmptyState
          icon={<Compass className="size-5" aria-hidden />}
          title="No such explainer"
          description="That concept is not in the library yet."
          action={
            <ButtonLink to="/learn" variant="secondary" size="sm">
              Back to Learn
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl space-y-6 py-8 sm:py-10">
      <Link
        to="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-content-muted transition-colors hover:text-content"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Learn
      </Link>

      <header className="space-y-3">
        <Badge tone="brand">{entry.category}</Badge>
        <h1 className="text-display-md">{entry.title}</h1>
        <p className="text-lg text-content-muted">{entry.oneLiner}</p>
        {entry.formula ? (
          <p data-numeric className="rounded-xl border border-hairline bg-canvas/50 px-4 py-3 text-sm">
            {entry.formula}
          </p>
        ) : null}
      </header>

      <div className="space-y-4">
        {entry.body.map((paragraph) => (
          <p key={paragraph} className="leading-relaxed text-content-muted">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-content-subtle" aria-hidden />
            How to read it
          </h2>
          <p className="text-sm leading-relaxed text-content-muted">{entry.howToRead}</p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CircleAlert className="size-4 text-content-subtle" aria-hidden />
            Where it misleads
          </h2>
          <p className="text-sm leading-relaxed text-content-muted">{entry.watchOut}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-content-subtle" aria-hidden />
          Where you see it in Plumbline
        </h2>
        <p className="text-sm leading-relaxed text-content-muted">{entry.whereInApp}</p>
      </Card>

      {entry.related.length ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Related</h2>
          <div className="flex flex-wrap gap-2">
            {entry.related.map((related) => {
              const target = LEARN_ENTRIES.find((item) => item.slug === related);
              if (!target) return null;

              return (
                <Link
                  key={related}
                  to={`/learn/${related}`}
                  className="rounded-full border border-hairline px-3.5 py-1.5 text-sm transition-colors hover:border-brand-500/50 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  {target.title}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
