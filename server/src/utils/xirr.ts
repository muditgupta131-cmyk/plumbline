export interface CashFlow {
  date: Date;
  amount: number;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const MAX_ITERATIONS = 80;
const TOLERANCE = 1e-7;

function presentValue(flows: CashFlow[], rate: number, start: number): number {
  return flows.reduce((total, flow) => {
    const years = (flow.date.getTime() - start) / MS_PER_YEAR;
    return total + flow.amount / (1 + rate) ** years;
  }, 0);
}

/**
 * Money-weighted return over irregular cash flows — the correct measure for SIPs and
 * staggered buys, where a simple CAGR over an averaged cost is misleading.
 * Outflows (purchases) are negative, inflows (sales, dividends, current value) positive.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;

  const ordered = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const start = ordered[0].date.getTime();

  const hasOutflow = ordered.some((flow) => flow.amount < 0);
  const hasInflow = ordered.some((flow) => flow.amount > 0);
  if (!hasOutflow || !hasInflow) return null;

  const span = (ordered[ordered.length - 1].date.getTime() - start) / MS_PER_YEAR;
  if (span < 1 / 365) return null;

  let rate = 0.1;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const value = presentValue(ordered, rate, start);
    if (Math.abs(value) < TOLERANCE) return rate;

    const derivative = ordered.reduce((total, flow) => {
      const years = (flow.date.getTime() - start) / MS_PER_YEAR;
      if (years === 0) return total;
      return total - (years * flow.amount) / (1 + rate) ** (years + 1);
    }, 0);

    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;

    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < TOLERANCE) return next;

    rate = next;
  }

  // Newton can stall on jagged flows; fall back to bisection over a wide, bounded range.
  let low = -0.9999;
  let high = 10;
  let lowValue = presentValue(ordered, low, start);

  if (lowValue * presentValue(ordered, high, start) > 0) return null;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2;
    const value = presentValue(ordered, mid, start);
    if (Math.abs(value) < TOLERANCE) return mid;

    if (lowValue * value < 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = value;
    }
  }

  return (low + high) / 2;
}

export function annualisedPercent(rate: number | null): number | null {
  if (rate === null || !Number.isFinite(rate)) return null;
  return Math.round(rate * 100 * 100) / 100;
}
