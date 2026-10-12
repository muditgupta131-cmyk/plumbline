import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import type { IpoSummary } from '@/types';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const STATUS_TONE = {
  open: 'bull',
  upcoming: 'accent',
  closed: 'neutral',
  listed: 'neutral',
} as const;

const STATUS_LABEL = {
  open: 'Open now',
  upcoming: 'Upcoming',
  closed: 'Closed',
  listed: 'Listed',
} as const;

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' | null }) {
  if (trend === 'up') return <TrendingUp className="size-3.5 text-bull" aria-label="rising" />;
  if (trend === 'down') return <TrendingDown className="size-3.5 text-bear" aria-label="falling" />;
  return <Minus className="size-3.5 text-content-subtle" aria-label="flat" />;
}

export function IpoCard({ ipo, onOpen }: { ipo: IpoSummary; onOpen: (slug: string) => void }) {
  const gmp = ipo.gmp;
  const window =
    ipo.openDate && ipo.closeDate
      ? `${formatDate(ipo.openDate)} – ${formatDate(ipo.closeDate)}`
      : ipo.listingDate
        ? `Listed ${formatDate(ipo.listingDate)}`
        : (ipo.dateLabel ?? 'Dates not announced');

  return (
    <Card interactive className="overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(ipo.slug)}
        className="w-full p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">{ipo.name}</p>
            <p className="text-xs text-content-subtle">{window}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={STATUS_TONE[ipo.status]}>{STATUS_LABEL[ipo.status]}</Badge>
            {ipo.board === 'sme' ? <Badge tone="neutral">SME</Badge> : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-content-subtle">Price band</dt>
            <dd className="mt-0.5 font-data font-medium" data-numeric>
              {ipo.priceBand.label?.replace(/Rs\./g, '₹') ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-content-subtle">Grey market</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-data font-medium" data-numeric>
              {gmp ? (
                <>
                  <TrendIcon trend={gmp.trend} />
                  <span className={cn(gmp.premium > 0 ? 'text-bull' : 'text-content-muted')}>
                    ₹{gmp.premium}
                    {gmp.premiumPercent !== null ? ` (${gmp.premiumPercent}%)` : ''}
                  </span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-content-subtle">Subscribed</dt>
            <dd className="mt-0.5 font-data font-medium" data-numeric>
              {ipo.subscription?.total != null ? `${ipo.subscription.total}×` : '—'}
            </dd>
          </div>
        </dl>
      </button>
    </Card>
  );
}
