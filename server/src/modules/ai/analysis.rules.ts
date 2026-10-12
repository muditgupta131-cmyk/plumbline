import { benchmarkFor } from '../../data/sectorBenchmarks.js';
import type { CompanyProfile, Fundamentals, Quote } from '../market/providers/index.js';
import type { ScoreBreakdown, Signal, SignalVerdict } from './ai.types.js';

interface Inputs {
  quote: Quote;
  profile: CompanyProfile | null;
  fundamentals: Fundamentals | null;
}

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  valuation: 0.22,
  profitability: 0.28,
  growth: 0.2,
  balanceSheet: 0.2,
  momentum: 0.1,
};

function scoreFor(verdict: SignalVerdict): number {
  return verdict === 'strong' ? 85 : verdict === 'neutral' ? 60 : 32;
}

function average(values: number[]): number {
  if (!values.length) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lowerIsBetter(value: number | null, benchmark: number, tolerance = 0.2): SignalVerdict {
  if (value === null) return 'neutral';
  if (value <= benchmark * (1 - tolerance)) return 'strong';
  if (value >= benchmark * (1 + tolerance)) return 'weak';
  return 'neutral';
}

function higherIsBetter(value: number | null, benchmark: number, tolerance = 0.2): SignalVerdict {
  if (value === null) return 'neutral';
  if (value >= benchmark * (1 + tolerance)) return 'strong';
  if (value <= benchmark * (1 - tolerance)) return 'weak';
  return 'neutral';
}

function pct(value: number | null, digits = 1): string {
  return value === null ? 'not reported' : `${value.toFixed(digits)}%`;
}

function mult(value: number | null, digits = 2): string {
  return value === null ? 'not reported' : `${value.toFixed(digits)}×`;
}

export interface RuleAnalysis {
  signals: Signal[];
  breakdown: ScoreBreakdown;
  overallScore: number;
  scoreLabel: string;
}

export function evaluate({ quote, profile, fundamentals }: Inputs): RuleAnalysis {
  const sector = profile?.sector ?? null;
  const benchmark = benchmarkFor(sector);
  const sectorLabel = sector ? `the ${sector} average` : 'the market average';

  const valuation = fundamentals?.valuation;
  const profitability = fundamentals?.profitability;
  const growth = fundamentals?.growth;
  const risk = fundamentals?.risk;

  const rangePosition =
    quote.week52High !== null && quote.week52Low !== null && quote.week52High > quote.week52Low
      ? ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100
      : null;

  const signals: Signal[] = [
    {
      id: 'pe',
      label: 'Earnings multiple',
      verdict: lowerIsBetter(valuation?.peRatio ?? null, benchmark.pe),
      detail: `P/E of ${mult(valuation?.peRatio ?? null)} against ${sectorLabel} of ${benchmark.pe.toFixed(0)}×.`,
      value: valuation?.peRatio ?? null,
      benchmark: benchmark.pe,
    },
    {
      id: 'ps',
      label: 'Sales multiple',
      verdict: lowerIsBetter(valuation?.priceToSales ?? null, benchmark.ps),
      detail: `P/S of ${mult(valuation?.priceToSales ?? null)} against ${sectorLabel} of ${benchmark.ps.toFixed(1)}×.`,
      value: valuation?.priceToSales ?? null,
      benchmark: benchmark.ps,
    },
    {
      id: 'roe',
      label: 'Return on equity',
      verdict: higherIsBetter(profitability?.roe ?? null, benchmark.roe),
      detail: `ROE of ${pct(profitability?.roe ?? null)} against ${sectorLabel} of ${benchmark.roe}%.`,
      value: profitability?.roe ?? null,
      benchmark: benchmark.roe,
    },
    {
      id: 'netMargin',
      label: 'Net margin',
      verdict: higherIsBetter(profitability?.netMargin ?? null, benchmark.netMargin),
      detail: `Net margin of ${pct(profitability?.netMargin ?? null)} against ${sectorLabel} of ${benchmark.netMargin}%.`,
      value: profitability?.netMargin ?? null,
      benchmark: benchmark.netMargin,
    },
    {
      id: 'revenueGrowth',
      label: 'Revenue growth',
      verdict: higherIsBetter(growth?.revenueGrowth ?? null, benchmark.growth),
      detail:
        growth?.revenueGrowth == null
          ? `Revenue growth is not reported by the connected data providers; ${sectorLabel} is ${benchmark.growth}%.`
          : `Revenue grew ${pct(growth.revenueGrowth)} year on year against ${sectorLabel} of ${benchmark.growth}%.`,
      value: growth?.revenueGrowth ?? null,
      benchmark: benchmark.growth,
    },
    {
      id: 'earningsGrowth',
      label: 'Earnings growth',
      verdict: higherIsBetter(growth?.earningsGrowth ?? null, benchmark.growth),
      detail:
        growth?.earningsGrowth == null
          ? 'Earnings growth is not reported by the connected data providers.'
          : `Earnings moved ${pct(growth.earningsGrowth)} year on year.`,
      value: growth?.earningsGrowth ?? null,
      benchmark: benchmark.growth,
    },
    {
      id: 'leverage',
      label: 'Leverage',
      verdict: lowerIsBetter(risk?.debtToEquity ?? null, benchmark.debtToEquity, 0.25),
      detail: `Debt to equity of ${mult(risk?.debtToEquity ?? null)} against ${sectorLabel} of ${benchmark.debtToEquity}×.`,
      value: risk?.debtToEquity ?? null,
      benchmark: benchmark.debtToEquity,
    },
    {
      id: 'liquidity',
      label: 'Liquidity',
      verdict: higherIsBetter(risk?.currentRatio ?? null, 1.5, 0.1),
      detail: `Current ratio of ${mult(risk?.currentRatio ?? null)}; below 1× means short-term bills exceed short-term assets.`,
      value: risk?.currentRatio ?? null,
      benchmark: 1.5,
    },
    {
      id: 'coverage',
      label: 'Interest cover',
      verdict: higherIsBetter(risk?.interestCoverage ?? null, 6, 0.3),
      detail: `Operating profit covers interest ${mult(risk?.interestCoverage ?? null)}.`,
      value: risk?.interestCoverage ?? null,
      benchmark: 6,
    },
    {
      id: 'range',
      label: '52 week position',
      verdict: rangePosition === null ? 'neutral' : rangePosition > 80 ? 'weak' : rangePosition < 25 ? 'strong' : 'neutral',
      detail:
        rangePosition === null
          ? 'No 52 week range reported.'
          : `Trading at ${rangePosition.toFixed(0)}% of its 52 week range.`,
      value: rangePosition,
      benchmark: 50,
    },
  ];

  const byId = new Map(signals.map((signal) => [signal.id, scoreFor(signal.verdict)]));
  const take = (...ids: string[]) => ids.map((id) => byId.get(id) ?? 50);

  const breakdown: ScoreBreakdown = {
    valuation: Math.round(average(take('pe', 'ps'))),
    profitability: Math.round(average(take('roe', 'netMargin'))),
    growth: Math.round(average(take('revenueGrowth', 'earningsGrowth'))),
    balanceSheet: Math.round(average(take('leverage', 'liquidity', 'coverage'))),
    momentum: Math.round(average(take('range'))),
  };

  const overallScore = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof ScoreBreakdown>).reduce(
      (total, key) => total + breakdown[key] * WEIGHTS[key],
      0,
    ),
  );

  const scoreLabel =
    overallScore >= 75
      ? 'Strong fundamentals'
      : overallScore >= 60
        ? 'Solid, with caveats'
        : overallScore >= 45
          ? 'Mixed picture'
          : 'Fundamentally stretched';

  return { signals, breakdown, overallScore, scoreLabel };
}
