import { AlertTriangle, CheckCircle2, CircleSlash, HelpCircle } from 'lucide-react';
import { Badge, Skeleton } from '@/components/ui';
import { QueryError } from '@/components/feedback';
import { useIpo } from '@/hooks/useIpos';
import type { IpoAnalysis, IpoDetail, IpoSignal } from '@/types';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const STANCE = {
  apply: { label: 'Leans towards applying', tone: 'bull', icon: CheckCircle2 },
  consider: { label: 'Mixed — read the signals', tone: 'accent', icon: AlertTriangle },
  avoid: { label: 'Leans against applying', tone: 'bear', icon: CircleSlash },
  insufficient: { label: 'Not enough data', tone: 'neutral', icon: HelpCircle },
} as const;

const SIGNAL_TONE: Record<IpoSignal['verdict'], string> = {
  strong: 'text-bull',
  fair: 'text-content',
  weak: 'text-bear',
  unknown: 'text-content-subtle',
};

function Verdict({ analysis }: { analysis: IpoAnalysis }) {
  const stance = STANCE[analysis.stance];
  const Icon = stance.icon;

  return (
    <div className="rounded-xl border border-hairline bg-surface-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4', SIGNAL_TONE[analysis.stance === 'avoid' ? 'weak' : 'strong'])} aria-hidden />
          <Badge tone={stance.tone}>{stance.label}</Badge>
        </div>
        {analysis.score !== null ? (
          <p className="font-data text-sm text-content-muted" data-numeric>
            {analysis.score}<span className="text-content-subtle">/100</span>
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-content-muted">{analysis.headline}</p>
    </div>
  );
}

function SubscriptionBars({ ipo }: { ipo: IpoDetail }) {
  const categories = ipo.subscription?.categories ?? [];
  if (!categories.length) return null;

  const ceiling = Math.max(...categories.map((entry) => entry.times), 1);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Who is bidding</h3>
      <ul className="space-y-2.5">
        {categories.map((entry) => (
          <li key={`${entry.key}-${entry.label}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-content-muted">{entry.label}</span>
              <span
                className={cn('font-data font-medium', entry.times >= 1 ? 'text-content' : 'text-bear')}
                data-numeric
              >
                {entry.times}×
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-content/[0.06]">
              <div
                className={cn('h-full rounded-full', entry.times >= 1 ? 'bg-brand-500' : 'bg-bear')}
                style={{ width: `${Math.max(2, Math.min(100, (entry.times / ceiling) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-content-subtle">
        A category under 1× has not been filled. Source: {ipo.subscription?.source}.
      </p>
    </section>
  );
}

/** The historical table is the honest frame for a grey market number, so it is shown beside it. */
function Calibration({ ipo }: { ipo: IpoDetail }) {
  if (!ipo.calibration?.bands.length) return null;
  const current = ipo.gmp?.premiumPercent ?? null;

  const bandOf = (percent: number) =>
    percent <= 0 ? 'No premium'
      : percent < 10 ? '0-10%'
      : percent < 20 ? '10-20%'
      : percent < 35 ? '20-35%'
      : percent < 60 ? '35-60%'
      : 'Over 60%';

  const activeBand = current !== null ? bandOf(current) : null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">What this premium has been worth before</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-xs">
          <thead className="text-content-subtle">
            <tr className="text-left">
              <th className="pb-2 font-medium">GMP band</th>
              <th className="pb-2 text-right font-medium">Issues</th>
              <th className="pb-2 text-right font-medium">Median listing</th>
              <th className="pb-2 text-right font-medium">Listed up</th>
            </tr>
          </thead>
          <tbody>
            {ipo.calibration.bands.map((band) => (
              <tr
                key={band.band}
                className={cn(
                  'border-t border-hairline',
                  band.band === activeBand && 'bg-brand-500/[0.07] font-medium text-content',
                )}
              >
                <td className="py-2">
                  {band.band}
                  {band.band === activeBand ? <span className="ml-2 text-brand-500">← this issue</span> : null}
                </td>
                <td className="py-2 text-right font-data" data-numeric>{band.sampleSize}</td>
                <td
                  className={cn('py-2 text-right font-data', band.medianActual >= 0 ? 'text-bull' : 'text-bear')}
                  data-numeric
                >
                  {band.medianActual > 0 ? '+' : ''}{band.medianActual}%
                </td>
                <td className="py-2 text-right font-data" data-numeric>{band.positiveRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-content-subtle">
        Measured across {ipo.calibration.sampleSize} past issues. The grey market pointed the right way{' '}
        {ipo.calibration.directionalAccuracy}% of the time and overstated the gain by{' '}
        {Math.abs(ipo.calibration.medianGmpError)} points on median — so treat it as a direction, not a price.
      </p>
    </section>
  );
}

export function IpoDetailPanel({ slug }: { slug: string }) {
  const query = useIpo(slug);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const ipo = query.data;

  return (
    <div className="space-y-6">
      <Verdict analysis={ipo.analysis} />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Price band', value: ipo.priceBand.label?.replace(/Rs\./g, '₹') ?? '—' },
          {
            label: 'Grey market',
            value: ipo.gmp
              ? `₹${ipo.gmp.premium}${ipo.gmp.premiumPercent !== null ? ` (${ipo.gmp.premiumPercent}%)` : ''}`
              : '—',
          },
          { label: 'Subscribed', value: ipo.subscription?.total != null ? `${ipo.subscription.total}×` : '—' },
          { label: 'Closes', value: ipo.closeDate ? formatDate(ipo.closeDate) : '—' },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-content-subtle">{item.label}</dt>
            <dd className="mt-1 font-data text-sm font-medium" data-numeric>{item.value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Signals</h3>
        <ul className="space-y-2.5">
          {ipo.analysis.signals.map((signal) => (
            <li key={signal.label} className="rounded-xl border border-hairline p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{signal.label}</p>
                <span className={cn('text-xs font-medium uppercase tracking-wide', SIGNAL_TONE[signal.verdict])}>
                  {signal.verdict}
                </span>
              </div>
              <p className="mt-1 text-xs text-content-muted">{signal.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <SubscriptionBars ipo={ipo} />
      <Calibration ipo={ipo} />

      <section className="space-y-2 rounded-xl border border-hairline bg-surface-muted/40 p-4">
        <h3 className="text-sm font-semibold">Before you apply</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-content-muted">
          {ipo.analysis.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
        <p className="pt-1 text-xs text-content-subtle">
          Listing and subscription data from {ipo.sources.listing}
          {ipo.sources.gmp ? `; grey market premium from ${ipo.sources.gmp}` : ''}.
        </p>
      </section>
    </div>
  );
}
