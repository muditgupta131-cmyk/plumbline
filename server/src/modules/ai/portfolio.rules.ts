import { benchmarkFor } from '../../data/sectorBenchmarks.js';
import type { Fundamentals } from '../market/providers/index.js';
import type { PortfolioValuation, ValuedHolding } from '../portfolio/portfolio.types.js';
import type { PerformancePoint } from '../portfolio/portfolio.types.js';
import type { Signal, SignalVerdict } from './ai.types.js';

export interface HoldingVerdict {
  symbol: string;
  name: string;
  weight: number;
  assetType: ValuedHolding['assetType'];
  valuation: 'expensive' | 'fair' | 'cheap' | 'unknown';
  quality: 'strong' | 'average' | 'weak' | 'unknown';
  reason: string;
}

export interface DiversificationBreakdown {
  concentration: number;
  sectors: number;
  assetClasses: number;
  geography: number;
  positionCount: number;
}

export interface PortfolioRuleAnalysis {
  signals: Signal[];
  diversificationScore: number;
  diversificationLabel: string;
  healthScore: number;
  healthLabel: string;
  breakdown: DiversificationBreakdown;
  concentration: {
    herfindahl: number;
    topWeight: number;
    topThreeWeight: number;
    topHolding: string | null;
  };
  drawdown: { maxDrawdownPercent: number | null; peakToTroughDays: number | null };
  verdicts: HoldingVerdict[];
  strongPositions: HoldingVerdict[];
  weakPositions: HoldingVerdict[];
  overvalued: HoldingVerdict[];
  undervalued: HoldingVerdict[];
  sectorImbalance: { sector: string; weight: number } | null;
  /** Share of the portfolio for which no provider published a sector. */
  unclassifiedWeight: number;
}

const UNKNOWN_SECTOR = 'Unclassified';

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scoreFor(verdict: SignalVerdict): number {
  return verdict === 'strong' ? 85 : verdict === 'neutral' ? 60 : 32;
}

function bandLabel(score: number, kind: 'diversification' | 'health'): string {
  if (kind === 'diversification') {
    if (score >= 75) return 'Well spread';
    if (score >= 60) return 'Reasonably spread';
    if (score >= 45) return 'Concentrated';
    return 'Highly concentrated';
  }

  if (score >= 75) return 'Healthy';
  if (score >= 60) return 'Sound, with gaps';
  if (score >= 45) return 'Needs attention';
  return 'Fragile';
}

export function maxDrawdown(points: PerformancePoint[]): { maxDrawdownPercent: number | null; peakToTroughDays: number | null } {
  const valued = points.filter((point) => point.value > 0);
  if (valued.length < 3) return { maxDrawdownPercent: null, peakToTroughDays: null };

  let peak = valued[0].value;
  let peakAt = new Date(valued[0].t).getTime();
  let worst = 0;
  let worstDays = 0;

  for (const point of valued) {
    if (point.value > peak) {
      peak = point.value;
      peakAt = new Date(point.t).getTime();
      continue;
    }

    const drop = ((peak - point.value) / peak) * 100;
    if (drop > worst) {
      worst = drop;
      worstDays = Math.round((new Date(point.t).getTime() - peakAt) / 86_400_000);
    }
  }

  return { maxDrawdownPercent: round(worst), peakToTroughDays: worstDays || null };
}

function classify(holding: ValuedHolding, fundamentals: Fundamentals | null): HoldingVerdict {
  const base = {
    symbol: holding.symbol,
    name: holding.name,
    weight: holding.weight,
    assetType: holding.assetType,
  };

  if (holding.assetType === 'MUTUAL_FUND') {
    return {
      ...base,
      valuation: 'unknown',
      quality: 'unknown',
      reason: `${holding.sector} — funds are judged on mandate and cost, not company multiples.`,
    };
  }

  if (!fundamentals) {
    return { ...base, valuation: 'unknown', quality: 'unknown', reason: 'No fundamentals available from the connected providers.' };
  }

  const benchmark = benchmarkFor(holding.sector);
  const pe = fundamentals.valuation.peRatio;
  const roe = fundamentals.profitability.roe;
  const margin = fundamentals.profitability.netMargin;
  const leverage = fundamentals.risk.debtToEquity;

  const valuation: HoldingVerdict['valuation'] =
    pe === null ? 'unknown' : pe > benchmark.pe * 1.25 ? 'expensive' : pe < benchmark.pe * 0.75 ? 'cheap' : 'fair';

  let qualityPoints = 0;
  let measured = 0;

  if (roe !== null) {
    measured += 1;
    qualityPoints += roe >= benchmark.roe ? 1 : roe <= benchmark.roe * 0.6 ? -1 : 0;
  }
  if (margin !== null) {
    measured += 1;
    qualityPoints += margin >= benchmark.netMargin ? 1 : margin <= benchmark.netMargin * 0.6 ? -1 : 0;
  }
  if (leverage !== null) {
    measured += 1;
    qualityPoints += leverage <= benchmark.debtToEquity ? 1 : leverage >= benchmark.debtToEquity * 1.6 ? -1 : 0;
  }

  const quality: HoldingVerdict['quality'] =
    measured === 0 ? 'unknown' : qualityPoints >= 2 ? 'strong' : qualityPoints <= -1 ? 'weak' : 'average';

  const parts: string[] = [];
  if (pe !== null) parts.push(`P/E ${pe.toFixed(1)} against a ${holding.sector} benchmark of ${benchmark.pe}`);
  if (roe !== null) parts.push(`ROE ${roe.toFixed(1)}%`);
  if (leverage !== null) parts.push(`debt/equity ${leverage.toFixed(2)}×`);

  return { ...base, valuation, quality, reason: parts.join(', ') || 'Limited fundamentals reported.' };
}

export function evaluatePortfolio(
  valuation: PortfolioValuation,
  fundamentals: Map<string, Fundamentals>,
  performance: PerformancePoint[],
): PortfolioRuleAnalysis {
  const priced = valuation.holdings.filter((holding) => holding.priced && (holding.value ?? 0) > 0);
  const weights = priced.map((holding) => holding.weight / 100);

  const herfindahl = round(weights.reduce((sum, weight) => sum + weight * weight, 0) * 100);
  const sorted = [...priced].sort((a, b) => b.weight - a.weight);
  const topWeight = sorted[0]?.weight ?? 0;
  const topThreeWeight = round(sorted.slice(0, 3).reduce((sum, holding) => sum + holding.weight, 0));

  const sectors = valuation.allocation.bySector;
  // "Unclassified" is the sentinel used wherever no provider published a sector. It is missing data,
  // not a sector, and letting it win these comparisons turns a coverage gap into investment advice.
  const classifiedSectors = sectors.filter((slice) => slice.label !== UNKNOWN_SECTOR);
  const unclassifiedWeight = round(sectors.find((slice) => slice.label === UNKNOWN_SECTOR)?.weight ?? 0);
  const topSector = classifiedSectors[0] ?? null;
  const assetClasses = valuation.allocation.byAssetClass.length;
  const markets = valuation.allocation.byMarket;
  const topMarketWeight = markets[0]?.weight ?? 100;

  const drawdown = maxDrawdown(performance);

  const verdicts = valuation.holdings.map((holding) =>
    classify(holding, fundamentals.get(holding.assetType === 'MUTUAL_FUND' ? '' : `${holding.exchange}:${holding.symbol}`) ?? null),
  );

  const signals: Signal[] = [
    {
      id: 'concentration',
      label: 'Concentration',
      verdict: herfindahl > 30 ? 'weak' : herfindahl > 18 ? 'neutral' : 'strong',
      detail: `The largest position is ${topWeight.toFixed(1)}% and the top three are ${topThreeWeight.toFixed(1)}% of the portfolio.`,
      value: herfindahl,
      benchmark: 18,
    },
    {
      id: 'positions',
      label: 'Position count',
      verdict: priced.length < 5 ? 'weak' : priced.length > 30 ? 'neutral' : 'strong',
      detail:
        priced.length < 5
          ? `${priced.length} positions leaves little room for anything to go wrong.`
          : priced.length > 30
            ? `${priced.length} positions is a lot to follow; returns will track the index closely.`
            : `${priced.length} positions is a workable number to actually follow.`,
      value: priced.length,
      benchmark: 15,
    },
    {
      id: 'sectors',
      label: 'Sector spread',
      verdict:
        (topSector?.weight ?? 100) > 45 ? 'weak' : classifiedSectors.length >= 5 ? 'strong' : 'neutral',
      detail: topSector
        ? `${classifiedSectors.length} sectors, with ${topSector.label} the largest at ${topSector.weight.toFixed(1)}%.` +
          (unclassifiedWeight > 0 ? ` A further ${unclassifiedWeight.toFixed(1)}% carries no published sector.` : '')
        : 'The connected data providers publish no sector for these holdings.',
      value: topSector?.weight ?? null,
      benchmark: 35,
    },
    {
      id: 'assetClass',
      label: 'Asset mix',
      verdict: assetClasses > 1 ? 'strong' : 'neutral',
      detail:
        assetClasses > 1
          ? `Stocks and funds together: ${valuation.allocation.byAssetClass.map((slice) => `${slice.label} ${slice.weight.toFixed(0)}%`).join(', ')}.`
          : 'Everything sits in a single asset class.',
      value: assetClasses,
      benchmark: 2,
    },
    {
      id: 'geography',
      label: 'Geography',
      verdict: topMarketWeight > 85 ? 'neutral' : 'strong',
      detail: markets.length
        ? `${markets.map((slice) => `${slice.label} ${slice.weight.toFixed(0)}%`).join(', ')}.`
        : 'No geographic split available.',
      value: topMarketWeight,
      benchmark: 70,
    },
    {
      id: 'drawdown',
      label: 'Worst drawdown',
      verdict:
        drawdown.maxDrawdownPercent === null
          ? 'neutral'
          : drawdown.maxDrawdownPercent > 25
            ? 'weak'
            : drawdown.maxDrawdownPercent > 12
              ? 'neutral'
              : 'strong',
      detail:
        drawdown.maxDrawdownPercent === null
          ? 'Not enough history to measure a drawdown.'
          : `The portfolio fell ${drawdown.maxDrawdownPercent.toFixed(1)}% from its peak over the charted period.`,
      value: drawdown.maxDrawdownPercent,
      benchmark: 15,
    },
  ];

  const byId = new Map(signals.map((signal) => [signal.id, scoreFor(signal.verdict)]));
  const pick = (id: string) => byId.get(id) ?? 60;

  const breakdown: DiversificationBreakdown = {
    concentration: pick('concentration'),
    sectors: pick('sectors'),
    assetClasses: pick('assetClass'),
    geography: pick('geography'),
    positionCount: pick('positions'),
  };

  const diversificationScore = Math.round(
    breakdown.concentration * 0.34 +
      breakdown.sectors * 0.26 +
      breakdown.positionCount * 0.18 +
      breakdown.assetClasses * 0.12 +
      breakdown.geography * 0.1,
  );

  const qualityWeighted = verdicts
    .filter((verdict) => verdict.quality !== 'unknown')
    .reduce(
      (accumulator, verdict) => {
        const points = verdict.quality === 'strong' ? 85 : verdict.quality === 'weak' ? 35 : 60;
        return { score: accumulator.score + points * verdict.weight, weight: accumulator.weight + verdict.weight };
      },
      { score: 0, weight: 0 },
    );

  const qualityScore = qualityWeighted.weight > 0 ? qualityWeighted.score / qualityWeighted.weight : 60;
  const healthScore = Math.round(diversificationScore * 0.45 + qualityScore * 0.4 + pick('drawdown') * 0.15);

  const rank = (verdict: HoldingVerdict) => verdict.weight;

  return {
    signals,
    diversificationScore,
    diversificationLabel: bandLabel(diversificationScore, 'diversification'),
    healthScore,
    healthLabel: bandLabel(healthScore, 'health'),
    breakdown,
    concentration: {
      herfindahl,
      topWeight: round(topWeight),
      topThreeWeight,
      topHolding: sorted[0]?.symbol ?? null,
    },
    drawdown,
    verdicts,
    strongPositions: verdicts.filter((v) => v.quality === 'strong').sort((a, b) => rank(b) - rank(a)).slice(0, 5),
    weakPositions: verdicts.filter((v) => v.quality === 'weak').sort((a, b) => rank(b) - rank(a)).slice(0, 5),
    overvalued: verdicts.filter((v) => v.valuation === 'expensive').sort((a, b) => rank(b) - rank(a)).slice(0, 5),
    undervalued: verdicts.filter((v) => v.valuation === 'cheap').sort((a, b) => rank(b) - rank(a)).slice(0, 5),
    sectorImbalance: topSector && topSector.weight > 40 ? { sector: topSector.label, weight: topSector.weight } : null,
    unclassifiedWeight,
  };
}
