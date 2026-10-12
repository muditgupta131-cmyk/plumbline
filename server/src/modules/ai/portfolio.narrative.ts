import type { PortfolioValuation } from '../portfolio/portfolio.types.js';
import type { PortfolioRuleAnalysis } from './portfolio.rules.js';

export interface PortfolioNarrative {
  summary: string;
  riskAnalysis: string;
  diversificationComment: string;
  suggestions: string[];
  strengths: string[];
  concerns: string[];
}

function money(value: number, currency: string): string {
  return `${currency === 'INR' ? '₹' : '$'}${Math.round(value).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
}

export function buildPortfolioNarrative(
  valuation: PortfolioValuation,
  rules: PortfolioRuleAnalysis,
): PortfolioNarrative {
  const { totals, baseCurrency } = valuation;
  const returnLine =
    totals.xirr !== null
      ? `a money-weighted return of ${totals.xirr.toFixed(2)}%`
      : totals.cagr !== null
        ? `an annualised ${totals.cagr.toFixed(2)}% measured from average cost`
        : 'no annualised return yet, as the holdings are too recent';

  const assetSplit = valuation.allocation.byAssetClass
    .map((slice) => `${slice.label.toLowerCase()} ${slice.weight.toFixed(0)}%`)
    .join(' and ');

  const strong = rules.signals.filter((signal) => signal.verdict === 'strong');
  const weak = rules.signals.filter((signal) => signal.verdict === 'weak');

  const suggestions: string[] = [];

  // Say plainly when a slice simply has no published sector, rather than staying silent about why
  // the sector picture is incomplete.
  if (rules.unclassifiedWeight >= 20) {
    suggestions.push(
      `${rules.unclassifiedWeight.toFixed(1)}% of the portfolio has no sector published by the connected data providers, so sector concentration cannot be judged for that part.`,
    );
  }

  if (rules.sectorImbalance) {
    suggestions.push(
      `${rules.sectorImbalance.sector} is ${rules.sectorImbalance.weight.toFixed(1)}% of the portfolio, so that sector's fortunes largely set the portfolio's.`,
    );
  }
  if (rules.concentration.topWeight > 30 && rules.concentration.topHolding) {
    suggestions.push(
      `${rules.concentration.topHolding} alone is ${rules.concentration.topWeight.toFixed(1)}% — a single-company setback moves the whole portfolio.`,
    );
  }
  if (rules.overvalued.length) {
    suggestions.push(
      `Trading above their sector benchmarks on earnings: ${rules.overvalued.map((v) => v.symbol).join(', ')}. That is a valuation observation, not a verdict on the business.`,
    );
  }
  if (rules.weakPositions.length) {
    suggestions.push(
      `Screening below sector benchmarks on returns or leverage: ${rules.weakPositions.map((v) => v.symbol).join(', ')}.`,
    );
  }
  if (valuation.allocation.byAssetClass.length === 1) {
    suggestions.push('Everything sits in one asset class, so there is nothing in the mix that behaves differently in a drawdown.');
  }
  if (!suggestions.length) {
    suggestions.push('No structural imbalance stands out on the current allocation and fundamentals.');
  }

  return {
    summary:
      `${valuation.name} holds ${totals.holdings} position${totals.holdings === 1 ? '' : 's'} worth ${money(totals.value, baseCurrency)} ` +
      `against ${money(totals.invested, baseCurrency)} invested, ${returnLine}. ` +
      (assetSplit ? `The mix is ${assetSplit}. ` : '') +
      (totals.realisedGain ? `Realised gains booked so far come to ${money(totals.realisedGain, baseCurrency)}.` : ''),
    riskAnalysis: [
      rules.signals.find((signal) => signal.id === 'concentration')?.detail,
      rules.signals.find((signal) => signal.id === 'sectors')?.detail,
      rules.signals.find((signal) => signal.id === 'drawdown')?.detail,
    ]
      .filter(Boolean)
      .join(' '),
    diversificationComment:
      `Diversification scores ${rules.diversificationScore} out of 100 (${rules.diversificationLabel.toLowerCase()}), weighing concentration most heavily, ` +
      `then sector spread, position count, asset mix and geography.`,
    suggestions: suggestions.slice(0, 5),
    strengths: strong.length
      ? strong.map((signal) => `${signal.label}: ${signal.detail}`)
      : ['No structural measure currently screens as a clear strength.'],
    concerns: weak.length
      ? weak.map((signal) => `${signal.label}: ${signal.detail}`)
      : ['No structural measure currently screens as a clear weakness.'],
  };
}
