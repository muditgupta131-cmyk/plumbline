import type { ReactNode } from 'react';
import {
  CircleAlert,
  Clock3,
  Info,
  Layers,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, Skeleton, SkeletonText } from '@/components/ui';
import type { HoldingVerdictSummary, PortfolioAnalysis } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ScoreDial } from './ScoreDial';
import { SignalGrid } from './SignalGrid';

interface PortfolioReviewProps {
  analysis: PortfolioAnalysis;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const BREAKDOWN_LABELS: Array<{ key: keyof PortfolioAnalysis['breakdown']; label: string }> = [
  { key: 'concentration', label: 'Concentration' },
  { key: 'sectors', label: 'Sector spread' },
  { key: 'positionCount', label: 'Position count' },
  { key: 'assetClasses', label: 'Asset mix' },
  { key: 'geography', label: 'Geography' },
];

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas/40 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-content-subtle">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: 'up' | 'down' | 'neutral' }) {
  if (!items.length) return <p className="text-sm text-content-subtle">Nothing to report.</p>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-relaxed text-content-muted">
          <span
            className={cn(
              'mt-1.5 size-1.5 shrink-0 rounded-full',
              tone === 'up' && 'bg-bull',
              tone === 'down' && 'bg-bear',
              tone === 'neutral' && 'bg-accent-600',
            )}
            aria-hidden
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function VerdictList({ title, verdicts, tone }: { title: string; verdicts: HoldingVerdictSummary[]; tone: 'up' | 'down' }) {
  if (!verdicts.length) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">{title}</p>
      <ul className="space-y-2">
        {verdicts.map((verdict) => (
          <li key={`${title}-${verdict.symbol}`} className="rounded-lg border border-hairline p-2.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className={cn(tone === 'up' ? 'text-bull' : 'text-bear')}>{verdict.symbol}</span>
              <span data-numeric className="text-xs text-content-subtle">
                {verdict.weight.toFixed(1)}%
              </span>
            </p>
            <p className="text-xs leading-relaxed text-content-muted">{verdict.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortfolioReviewSkeleton() {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton rounded="full" className="size-32 shrink-0" />
        <Skeleton rounded="full" className="size-32 shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton rounded="sm" className="h-4 w-44" />
          <SkeletonText lines={4} />
        </div>
      </div>
    </Card>
  );
}

export function PortfolioReview({ analysis, refreshing, onRefresh }: PortfolioReviewProps) {
  const byAi = analysis.engine === 'openai';

  return (
    <Card className="p-5 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
            {byAi ? 'AI portfolio review' : 'Portfolio review'}
          </h3>
          <p className="flex flex-wrap items-center gap-2 text-xs text-content-subtle">
            <Badge tone={byAi ? 'brand' : 'neutral'}>{byAi ? (analysis.model ?? 'OpenAI') : 'Rule engine'}</Badge>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden />
              {formatRelativeTime(analysis.generatedAt)}
            </span>
          </p>
        </div>

        {onRefresh ? (
          <Button
            size="sm"
            variant="secondary"
            loading={refreshing}
            onClick={onRefresh}
            icon={<RefreshCw className="size-3.5" aria-hidden />}
          >
            Regenerate
          </Button>
        ) : null}
      </header>

      {analysis.dataCaveat ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm text-amber-700 dark:text-amber-400">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {analysis.dataCaveat}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
            <ScoreDial score={analysis.healthScore} label={analysis.healthLabel} size={128} />
            <ScoreDial
              score={analysis.diversificationScore}
              label={analysis.diversificationLabel}
              size={128}
            />
          </div>

          <dl className="space-y-2.5">
            {BREAKDOWN_LABELS.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <dt className="text-content-muted">{item.label}</dt>
                  <dd data-numeric className="font-medium">
                    {analysis.breakdown[item.key]}
                  </dd>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-content/[0.06]">
                  <div
                    style={{ width: `${analysis.breakdown[item.key]}%` }}
                    className={cn(
                      'h-full rounded-full',
                      analysis.breakdown[item.key] >= 70
                        ? 'bg-bull'
                        : analysis.breakdown[item.key] >= 50
                          ? 'bg-amber-500'
                          : 'bg-bear',
                    )}
                  />
                </div>
              </div>
            ))}
          </dl>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-hairline p-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-content-subtle">Largest position</dt>
              <dd data-numeric className="text-sm font-semibold">
                {analysis.concentration.topHolding ?? '—'} · {analysis.concentration.topWeight.toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-content-subtle">Worst drawdown</dt>
              <dd data-numeric className="text-sm font-semibold">
                {analysis.drawdown.maxDrawdownPercent === null
                  ? '—'
                  : `${analysis.drawdown.maxDrawdownPercent.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Panel icon={<Layers className="size-4" aria-hidden />} title="What this portfolio is">
            <p className="text-sm leading-relaxed text-content-muted">{analysis.summary}</p>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel icon={<ShieldAlert className="size-4" aria-hidden />} title="Risk">
              <p className="text-sm leading-relaxed text-content-muted">{analysis.riskAnalysis}</p>
            </Panel>
            <Panel icon={<Layers className="size-4" aria-hidden />} title="Diversification">
              <p className="text-sm leading-relaxed text-content-muted">{analysis.diversificationComment}</p>
            </Panel>
          </div>

          <Panel icon={<Lightbulb className="size-4" aria-hidden />} title="What stands out">
            <Bullets items={analysis.suggestions} tone="neutral" />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel icon={<TrendingUp className="size-4" aria-hidden />} title="Strengths">
              <Bullets items={analysis.strengths} tone="up" />
            </Panel>
            <Panel icon={<TrendingDown className="size-4" aria-hidden />} title="Concerns">
              <Bullets items={analysis.concerns} tone="down" />
            </Panel>
          </div>
        </div>
      </div>

      {analysis.strongPositions.length ||
      analysis.weakPositions.length ||
      analysis.overvalued.length ||
      analysis.undervalued.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <VerdictList title="Strong positions" verdicts={analysis.strongPositions} tone="up" />
          <VerdictList title="Weak positions" verdicts={analysis.weakPositions} tone="down" />
          <VerdictList title="Richly valued" verdicts={analysis.overvalued} tone="down" />
          <VerdictList title="Cheaply valued" verdicts={analysis.undervalued} tone="up" />
        </div>
      ) : null}

      <div className="mt-6">
        <h4 className="mb-3 text-sm font-semibold">How the scores were built</h4>
        <SignalGrid signals={analysis.signals} />
      </div>

      <p className="mt-6 flex items-start gap-2 border-t border-hairline pt-4 text-xs text-content-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Generated from your own holdings for research and education. It is not investment advice and not a
        recommendation to buy or sell anything. Classifications compare each company against broad sector averages,
        which is a rough guide rather than a judgement on the business.
      </p>
    </Card>
  );
}
