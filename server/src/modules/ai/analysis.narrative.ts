import type { CompanyProfile, Fundamentals, Quote } from '../market/providers/index.js';
import type { RuleAnalysis } from './analysis.rules.js';
import type { Signal } from './ai.types.js';

interface NarrativeInputs {
  quote: Quote;
  profile: CompanyProfile | null;
  fundamentals: Fundamentals | null;
  rules: RuleAnalysis;
}

export interface Narrative {
  businessSummary: string;
  strengths: string[];
  weaknesses: string[];
  growthPotential: string;
  financialHealth: string;
  valuation: string;
  risks: string[];
  competitors: string[];
  shortTermOutlook: string;
  longTermOutlook: string;
  investorFit: string;
}

function byId(signals: Signal[], id: string): Signal | undefined {
  return signals.find((signal) => signal.id === id);
}

function firstSentences(text: string | null | undefined, count: number): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=\.)\s+/).slice(0, count).join(' ');
  return sentences.length > 40 ? sentences : text.slice(0, 320);
}

export function buildNarrative({ quote, profile, fundamentals, rules }: NarrativeInputs): Narrative {
  const { signals, breakdown } = rules;
  const name = profile?.name ?? quote.symbol;
  const sector = profile?.sector ?? 'an unclassified sector';

  const strong = signals.filter((signal) => signal.verdict === 'strong');
  const weak = signals.filter((signal) => signal.verdict === 'weak');

  const summary =
    firstSentences(profile?.description, 3) ??
    `${name} trades on the ${quote.exchange} in ${sector}. No filed business description is available from the connected data providers.`;

  const growthSignal = byId(signals, 'revenueGrowth');
  const earningsSignal = byId(signals, 'earningsGrowth');
  const leverageSignal = byId(signals, 'leverage');
  const liquiditySignal = byId(signals, 'liquidity');
  const coverageSignal = byId(signals, 'coverage');
  const peSignal = byId(signals, 'pe');
  const psSignal = byId(signals, 'ps');
  const rangeSignal = byId(signals, 'range');

  const dividendYield = fundamentals?.dividend.yield ?? null;
  const beta = fundamentals?.risk.beta ?? null;

  const volatility =
    beta !== null && beta >= 1.3
      ? ` A beta of ${beta.toFixed(2)} means it has historically swung harder than the index in both directions.`
      : beta !== null && beta <= 0.8
        ? ` A beta of ${beta.toFixed(2)} means it has historically been steadier than the index.`
        : '';

  const investorFit =
    dividendYield !== null && dividendYield >= 2.5
      ? `The dividend yield of ${dividendYield.toFixed(2)}% puts this closer to an income holding. Investors who need capital growth above all else will find more of it elsewhere.`
      : breakdown.growth >= 70
        ? 'The growth profile suits investors with a long horizon who can sit through volatility. It is a poor fit for anyone who needs the money back within a year or two.'
        : 'This profile sits between income and growth. It tends to suit investors who want a core holding rather than a concentrated bet, and it will disappoint anyone looking for a quick move.';

  const investorFitWithVolatility = `${investorFit}${volatility}`;

  return {
    businessSummary: summary,
    strengths: strong.length
      ? strong.map((signal) => `${signal.label}: ${signal.detail}`)
      : ['No metric currently screens above its sector benchmark on the data available.'],
    weaknesses: weak.length
      ? weak.map((signal) => `${signal.label}: ${signal.detail}`)
      : ['No metric currently screens materially below its sector benchmark on the data available.'],
    growthPotential: [growthSignal?.detail, earningsSignal?.detail].filter(Boolean).join(' ') ||
      'Growth figures are not reported by the connected data providers.',
    financialHealth:
      [leverageSignal?.detail, liquiditySignal?.detail, coverageSignal?.detail].filter(Boolean).join(' ') ||
      'Balance sheet figures are not reported by the connected data providers.',
    valuation:
      [peSignal?.detail, psSignal?.detail].filter(Boolean).join(' ') ||
      'Valuation multiples are not reported by the connected data providers.',
    risks: [
      // Not "below": on a lower-is-better measure like P/E, a weak reading is above the benchmark.
      // The detail already spells out both numbers, so the framing stays direction-neutral.
      ...weak.map((signal) => `${signal.label} screens weaker than its sector benchmark: ${signal.detail}`),
      'Sector benchmarks are broad averages; a company can look cheap or expensive purely because of its business mix.',
      'Every figure here is backward looking. It describes what has already been reported, not what happens next.',
      'Price and fundamentals can drift apart for long stretches. A sound business can still lose value in a falling market.',
    ].slice(0, 5),
    competitors: [],
    shortTermOutlook:
      rangeSignal?.detail ??
      `The stock last moved ${quote.changePercent.toFixed(2)}% on the session. No range data is available for context.`,
    longTermOutlook:
      breakdown.profitability >= 70
        ? 'Returns on capital are running ahead of the sector, which is usually the signal that matters most over a five year horizon — provided the company can keep reinvesting at that rate.'
        : breakdown.profitability <= 45
          ? 'Returns on capital trail the sector. Over a long horizon that usually caps how much value the business can compound unless margins recover.'
          : 'Returns on capital sit close to the sector average, so long-run performance will likely track the sector rather than break away from it.',
    investorFit: investorFitWithVolatility,
  };
}
