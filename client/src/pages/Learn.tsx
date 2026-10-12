import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Card } from '@/components/ui';
import { LEARN_CATEGORIES, LEARN_ENTRIES } from '@/content/learn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function LearnPage() {
  useDocumentTitle('Learn investing', 'P/E, ROE, XIRR, NAV and the rest — explained plainly, with the catch in each one.');

  return (
    <div className="container space-y-8 py-8 sm:py-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Learn</p>
        <h1 className="text-display-md">The numbers, explained</h1>
        <p className="text-content-muted">
          Every metric Plumbline shows you, in plain language — what it means, how to read it, and the way each one
          can mislead. No jargon left undefined.
        </p>
      </header>

      {LEARN_CATEGORIES.map((category) => {
        const entries = LEARN_ENTRIES.filter((entry) => entry.category === category);
        if (!entries.length) return null;

        return (
          <section key={category} className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <GraduationCap className="size-4 text-content-subtle" aria-hidden />
              {category}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <Link key={entry.slug} to={`/learn/${entry.slug}`}>
                  <Card interactive className="h-full p-4">
                    <h3 className="text-sm font-semibold">{entry.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-content-muted">{entry.oneLiner}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
