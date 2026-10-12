import type { PortfolioValuation } from '../portfolio/portfolio.types.js';
import type { ChatMessage } from './openai.client.js';
import type { PortfolioRuleAnalysis } from './portfolio.rules.js';

export const PORTFOLIO_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'riskAnalysis', 'diversificationComment', 'suggestions', 'strengths', 'concerns'],
  properties: {
    summary: { type: 'string', description: 'Three to five sentences on what this portfolio actually is: what it owns, where the money sits, and how it has done.' },
    riskAnalysis: { type: 'string', description: 'The concrete risks in this specific mix — concentration, sector, currency, drawdown.' },
    diversificationComment: { type: 'string', description: 'What the diversification score reflects, in plain terms.' },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Three to five specific, actionable observations. Describe imbalances and trade-offs; never tell the reader to buy or sell a named security.',
    },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Two to four things this portfolio does well.' },
    concerns: { type: 'array', items: { type: 'string' }, description: 'Two to four things worth watching.' },
  },
};

const SYSTEM_PROMPT = `You are a portfolio analyst writing for the person who owns this portfolio, on Plumbline.

Rules you must follow:
- Ground every claim in the FACTS block. Never invent a number, a holding, or a weight.
- The scores, weights and classifications in FACTS were computed deterministically. Explain them; do not recompute or contradict them.
- Do not tell the reader to buy, sell, hold, switch or rebalance into anything specific, and never give price targets. Describe what the mix exposes them to and what the trade-offs are, and let them decide.
- Mutual funds are judged on mandate and category, not company multiples. Never call a fund overvalued on a P/E basis.
- Be specific and plain. "72% sits in Technology, so a sector de-rating hits most of the portfolio at once" beats "consider diversifying".
- No hype, no filler, no restating the instructions.`;

function compact(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => (entry === null ? undefined : entry), 2);
}

export function buildPortfolioMessages(
  valuation: PortfolioValuation,
  rules: PortfolioRuleAnalysis,
  simulated: boolean,
): ChatMessage[] {
  const facts = {
    portfolio: {
      name: valuation.name,
      baseCurrency: valuation.baseCurrency,
      holdings: valuation.totals.holdings,
      value: valuation.totals.value,
      invested: valuation.totals.invested,
      unrealisedPnL: valuation.totals.pnl,
      unrealisedPnLPercent: valuation.totals.pnlPercent,
      realisedGain: valuation.totals.realisedGain,
      dividendsReceived: valuation.totals.dividendsReceived,
      moneyWeightedReturnXirr: valuation.totals.xirr,
      annualisedCagr: valuation.totals.cagr,
      estimatedAnnualDividend: valuation.totals.annualDividend,
    },
    positions: valuation.holdings.map((holding) => ({
      symbol: holding.symbol,
      name: holding.name,
      type: holding.assetType,
      sector: holding.sector,
      market: holding.market,
      weightPercent: holding.weight,
      unrealisedPnLPercent: holding.pnlPercent,
      xirr: holding.xirr,
    })),
    allocation: {
      bySector: valuation.allocation.bySector.map((slice) => ({ label: slice.label, weight: slice.weight })),
      byAssetClass: valuation.allocation.byAssetClass.map((slice) => ({ label: slice.label, weight: slice.weight })),
      byMarket: valuation.allocation.byMarket.map((slice) => ({ label: slice.label, weight: slice.weight })),
    },
    computedScores: {
      diversification: { score: rules.diversificationScore, label: rules.diversificationLabel, breakdown: rules.breakdown },
      health: { score: rules.healthScore, label: rules.healthLabel },
    },
    computedSignals: rules.signals.map((signal) => ({ label: signal.label, verdict: signal.verdict, detail: signal.detail })),
    concentration: rules.concentration,
    drawdown: rules.drawdown,
    classifications: {
      strongPositions: rules.strongPositions,
      weakPositions: rules.weakPositions,
      overvalued: rules.overvalued,
      undervalued: rules.undervalued,
      sectorImbalance: rules.sectorImbalance,
    },
  };

  const caveat = simulated
    ? '\n\nIMPORTANT: the prices behind these figures are SIMULATED sample data, not live quotes. Open the summary by saying so.'
    : '';

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Analyse this portfolio.${caveat}\n\nFACTS:\n${compact(facts)}` },
  ];
}
