import { benchmarkFor } from '../../data/sectorBenchmarks.js';
import type { CompanyProfile, Fundamentals, Quote } from '../market/providers/index.js';
import type { ChatMessage } from './openai.client.js';
import type { RuleAnalysis } from './analysis.rules.js';

export const ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'businessSummary',
    'strengths',
    'weaknesses',
    'growthPotential',
    'financialHealth',
    'valuation',
    'risks',
    'competitors',
    'shortTermOutlook',
    'longTermOutlook',
    'investorFit',
  ],
  properties: {
    businessSummary: { type: 'string', description: 'Two to four sentences on what the company actually sells and how it makes money.' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Three to five specific strengths, each one sentence.' },
    weaknesses: { type: 'array', items: { type: 'string' }, description: 'Three to five specific weaknesses, each one sentence.' },
    growthPotential: { type: 'string' },
    financialHealth: { type: 'string' },
    valuation: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' }, description: 'Three to five risks a holder should watch.' },
    competitors: { type: 'array', items: { type: 'string' }, description: 'Three to six listed competitors by company name.' },
    shortTermOutlook: { type: 'string', description: 'Next few quarters, framed as what to watch rather than a price call.' },
    longTermOutlook: { type: 'string', description: 'Three to five year view of the business.' },
    investorFit: { type: 'string', description: 'The kind of investor this profile tends to suit, and who it does not.' },
  },
};

const SYSTEM_PROMPT = `You are an equity research analyst writing for retail investors on Plumbline.

Rules you must follow:
- Ground every claim in the FACTS block you are given. Never invent a number, and never state a figure that is not in the FACTS.
- If a figure is missing, say the data is not reported rather than estimating it.
- You may use well-known qualitative knowledge about the company (what it sells, who competes with it) but never invent financial figures.
- Do not give buy, sell or hold recommendations, price targets, or personalised advice. Describe the business and what the numbers show, and let the reader decide.
- Write plainly: short sentences, no jargon without a short explanation, no hype, no filler like "in conclusion".
- Be specific. "Net margin of 18.6% is above the 14% sector benchmark" beats "strong profitability".
- Where the FACTS and the company's reputation disagree, trust the FACTS and say what they show.`;

function compact(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => (entry === null ? undefined : entry), 2);
}

interface PromptInputs {
  quote: Quote;
  profile: CompanyProfile | null;
  fundamentals: Fundamentals | null;
  rules: RuleAnalysis;
  simulated: boolean;
}

export function buildAnalysisMessages({ quote, profile, fundamentals, rules, simulated }: PromptInputs): ChatMessage[] {
  const benchmark = benchmarkFor(profile?.sector);

  const facts = {
    company: {
      name: profile?.name ?? quote.symbol,
      symbol: quote.symbol,
      exchange: quote.exchange,
      sector: profile?.sector ?? 'not reported',
      industry: profile?.industry ?? 'not reported',
      headquarters: profile?.headquarters ?? undefined,
      employees: profile?.employees ?? undefined,
      description: profile?.description ?? undefined,
    },
    marketData: {
      currency: quote.currency,
      price: quote.price,
      changePercentToday: quote.changePercent,
      week52High: quote.week52High,
      week52Low: quote.week52Low,
      marketCap: quote.marketCap ?? profile?.marketCap ?? undefined,
      volume: quote.volume,
    },
    fundamentals: fundamentals
      ? {
          fiscalPeriod: fundamentals.fiscalPeriod,
          valuation: fundamentals.valuation,
          profitability: fundamentals.profitability,
          growth: fundamentals.growth,
          financials: fundamentals.financials,
          perShare: fundamentals.perShare,
          dividend: fundamentals.dividend,
          risk: fundamentals.risk,
          annualHistory: fundamentals.annual,
        }
      : 'not available',
    sectorBenchmarks: benchmark,
    computedSignals: rules.signals.map((signal) => ({
      label: signal.label,
      verdict: signal.verdict,
      detail: signal.detail,
    })),
    computedScore: { overall: rules.overallScore, label: rules.scoreLabel, breakdown: rules.breakdown },
  };

  const caveat = simulated
    ? `\n\nIMPORTANT: these figures are SIMULATED sample data, not real filings. Write the analysis as an illustration of the method and open businessSummary by saying the figures are simulated.`
    : '';

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Write the research report for ${profile?.name ?? quote.symbol} (${quote.exchange}:${quote.symbol}).${caveat}\n\nFACTS:\n${compact(facts)}`,
    },
  ];
}
