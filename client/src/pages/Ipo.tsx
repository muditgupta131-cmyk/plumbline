import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { Modal, SkeletonCard } from '@/components/ui';
import { EmptyState, QueryError } from '@/components/feedback';
import { IpoCard, IpoDetailPanel } from '@/components/ipo';
import { useIpos } from '@/hooks/useIpos';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { IpoStatus } from '@/types';
import { cn } from '@/utils/cn';

const FILTERS: Array<{ id: 'all' | IpoStatus; label: string }> = [
  { id: 'open', label: 'Open now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
  { id: 'listed', label: 'Recently listed' },
  { id: 'all', label: 'Everything' },
];

export default function IpoPage() {
  const [params, setParams] = useSearchParams();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const filterParam = params.get('show');
  const filter = FILTERS.some((entry) => entry.id === filterParam)
    ? (filterParam as 'all' | IpoStatus)
    : 'open';

  const query = useIpos();

  useDocumentTitle(
    'IPO analysis',
    'Open and upcoming IPOs with grey market premium, live subscription and how that premium has actually paid off before.',
  );

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const ipo of query.data?.ipos ?? []) tally.set(ipo.status, (tally.get(ipo.status) ?? 0) + 1);
    return tally;
  }, [query.data]);

  const visible = (query.data?.ipos ?? []).filter((ipo) => filter === 'all' || ipo.status === filter);
  const selected = query.data?.ipos.find((ipo) => ipo.slug === openSlug) ?? null;

  const setFilter = (next: string) => {
    const search = new URLSearchParams(params);
    search.set('show', next);
    setParams(search, { replace: true });
  };

  return (
    <div className="container space-y-6 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-eyebrow uppercase text-brand-600 dark:text-brand-400">Primary market</p>
        <h1 className="text-display-md">IPOs</h1>
        <p className="max-w-2xl text-sm text-content-subtle">
          Every open and upcoming issue, with the grey market premium alongside the live order book — and
          what a premium that size has actually been worth on listing day before now.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-full border border-hairline p-1" role="group" aria-label="Filter IPOs">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === option.id ? 'bg-brand-600 text-white' : 'text-content-muted hover:text-content',
            )}
          >
            {option.label}
            {counts.get(option.id) ? (
              <span className="ml-1.5 text-xs opacity-70">{counts.get(option.id)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ipo) => (
            <IpoCard key={ipo.slug} ipo={ipo} onOpen={setOpenSlug} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Rocket className="size-6" aria-hidden />}
          title="Nothing here right now"
          description={
            filter === 'open'
              ? 'No issue is open for applications today. Check the upcoming tab.'
              : 'No issues match this filter.'
          }
        />
      )}

      <Modal
        open={Boolean(openSlug)}
        onClose={() => setOpenSlug(null)}
        title={selected?.name ?? 'IPO'}
        description={
          selected
            ? `${selected.board === 'sme' ? 'SME issue' : 'Mainboard issue'}${selected.symbol ? ` · ${selected.symbol}` : ''}`
            : undefined
        }
        className="max-w-2xl"
      >
        {openSlug ? <IpoDetailPanel slug={openSlug} /> : null}
      </Modal>
    </div>
  );
}
