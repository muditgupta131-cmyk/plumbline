import {
  Building2,
  CircleAlert,
  Clock3,
  Info,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, Card, Skeleton, SkeletonText } from '@/components/ui';
import type { StockAnalysis } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ScoreBreakdownBars } from './ScoreBreakdownBars';
import { ScoreDial } from './ScoreDial';
import { SignalGrid } from './SignalGrid';

interface AnalysisReportProps {
  analysis: StockAnalysis;
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface PanelProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}

function Panel({ icon, title, children, className }: PanelProps) {
  return (
    <div className={cn('rounded-xl border border-hairline bg-canvas/40 p-4', className)}>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-content-subtle">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: 'up' | 'down' }) {
  if (!items.length) return <p className="text-sm text-content-subtle">Nothing notable to report.</p>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-relaxed text-content-muted">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', tone === 'up' ? 'bg-bull' : 'bg-bear')} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AnalysisReportSkeleton() {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton rounded="full" className="size-36 shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton rounded="sm" className="h-4 w-40" />
          <SkeletonText lines={4} />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </Card>
  );
}

export function AnalysisReport({ analysis, refreshing, onRefresh }: AnalysisReportProps) {
  const byAi = analysis.engine === 'openai';

  return (
    <Card className="p-5 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
            {byAi ? 'AI research report' : 'Research report'}
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
        <div className="flex flex-col items-center gap-5 lg:col-span-4">
          <ScoreDial score={analysis.overallScore} label={analysis.scoreLabel} />
          <div className="w-full">
            <ScoreBreakdownBars breakdown={analysis.scoreBreakdown} />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Panel icon={<Building2 className="size-4" aria-hidden />} title="Business summary">
            <p className="text-sm leading-relaxed text-content-muted">{analysis.businessSummary}</p>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel icon={<TrendingUp className="size-4" aria-hidden />} title="Strengths">
              <Bullets items={analysis.strengths} tone="up" />
            </Panel>
            <Panel icon={<CircleAlert className="size-4" aria-hidden />} title="Weaknesses">
              <Bullets items={analysis.weaknesses} tone="down" />
            </Panel>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Panel icon={<TrendingUp className="size-4" aria-hidden />} title="Growth potential">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.growthPotential}</p>
        </Panel>
        <Panel icon={<Shield className="size-4" aria-hidden />} title="Financial health">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.financialHealth}</p>
        </Panel>
        <Panel icon={<Wallet className="size-4" aria-hidden />} title="Valuation">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.valuation}</p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel icon={<CircleAlert className="size-4" aria-hidden />} title="Risks to watch">
          <Bullets items={analysis.risks} tone="down" />
        </Panel>
        <Panel icon={<Users className="size-4" aria-hidden />} title="Competitors">
          {analysis.competitors.length ? (
            <div className="flex flex-wrap gap-2">
              {analysis.competitors.map((competitor) => (
                <Badge key={competitor}>{competitor}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-subtle">
              The rule engine does not identify competitors. Connect an AI key for peer context.
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Panel icon={<Clock3 className="size-4" aria-hidden />} title="Short term outlook">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.shortTermOutlook}</p>
        </Panel>
        <Panel icon={<Target className="size-4" aria-hidden />} title="Long term outlook">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.longTermOutlook}</p>
        </Panel>
        <Panel icon={<Users className="size-4" aria-hidden />} title="Who it suits">
          <p className="text-sm leading-relaxed text-content-muted">{analysis.investorFit}</p>
        </Panel>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 text-sm font-semibold">How the score was built</h4>
        <SignalGrid signals={analysis.signals} />
      </div>

      <p className="mt-6 flex items-start gap-2 border-t border-hairline pt-4 text-xs text-content-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        This report is generated from public market data for research and education. It is not investment advice, not a
        recommendation to buy or sell, and it can be wrong. Verify every figure before you act on it.
      </p>
    </Card>
  );
}
