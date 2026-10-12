import { cached } from '../market/market.cache.js';
import { xirr } from '../../utils/xirr.js';
import { fetchBonds, type BondSegment, type RawBond } from './nse.bonds.js';

/** The debt list changes slowly and most rows do not trade at all, so a short cache is plenty. */
const DATASET_TTL_MS = 10 * 60_000;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export interface BondRow extends Omit<RawBond, 'maturity'> {
  maturity: string | null;
  yearsToMaturity: number | null;
  /** Annual coupon income against the price paid. Exact, and free of any timing assumption. */
  currentYield: number | null;
  /** Redemption yield, assuming annual coupons — the frequency is not published. */
  yieldToMaturity: number | null;
  ratingGrade: string | null;
}

/**
 * Redemption yield: what the bond returns if held to maturity, counting both the coupons and the
 * pull to par.
 *
 * Two things are not published and both bias this, so they bound where it may be quoted at all.
 * Coupon *frequency* is unknown, so annual payments are assumed. Coupon *dates* are unknown, so the
 * schedule is laid backwards from maturity — the convention — and the exchange price is a clean one,
 * excluding the accrued interest a buyer also pays. Inside a year that accrual dominates: a bond
 * redeeming in a fortnight would appear to pay a whole year's coupon for a fortnight's wait, which
 * is how a 9% bond reads as 500%. Below a year there is no honest approximation, so none is offered.
 */
const MIN_YEARS_FOR_YTM = 1;
const PLAUSIBLE_YIELD_LIMIT = 40;

export function yieldToMaturity(
  price: number | null,
  faceValue: number | null,
  couponRate: number | null,
  maturity: Date | null,
  today = new Date(),
): number | null {
  if (!price || price <= 0 || !faceValue || faceValue <= 0 || !maturity) return null;

  const years = (maturity.getTime() - today.getTime()) / MS_PER_YEAR;
  if (years < MIN_YEARS_FOR_YTM || years > 60) return null;

  const annualCoupon = ((couponRate ?? 0) / 100) * faceValue;
  const flows = [{ date: today, amount: -price }];

  // Coupons fall on anniversaries of redemption, not of today.
  for (let back = 1; ; back += 1) {
    const due = new Date(maturity);
    due.setUTCFullYear(due.getUTCFullYear() - back);
    if (due <= today) break;
    flows.push({ date: due, amount: annualCoupon });
  }

  // Redemption pays the final coupon alongside the principal.
  flows.push({ date: maturity, amount: faceValue + annualCoupon });

  const rate = xirr(flows);
  if (rate === null) return null;

  const percent = Math.round(rate * 100 * 100) / 100;
  // A yield outside this range says the inputs were wrong, not that the bond is extraordinary.
  return Math.abs(percent) > PLAUSIBLE_YIELD_LIMIT ? null : percent;
}

/** "AA/Stable, AA+/Negative" describes one bond twice. The leading grade is what people filter on. */
export function ratingGrade(rating: string | null): string | null {
  if (!rating) return null;
  const first = rating.split(',')[0]?.split('/')[0]?.trim().toUpperCase();
  if (!first) return null;
  const match = /^(AAA|AA|A|BBB|BB|B|CCC|CC|C|D)[+-]?$/.exec(first.replace(/\s+/g, ''));
  return match ? match[1] : null;
}

function decorate(bond: RawBond, now: Date): BondRow {
  const years = bond.maturity ? (bond.maturity.getTime() - now.getTime()) / MS_PER_YEAR : null;
  const annualCoupon = bond.faceValue && bond.couponRate ? (bond.couponRate / 100) * bond.faceValue : null;

  return {
    ...bond,
    maturity: bond.maturity ? bond.maturity.toISOString() : null,
    yearsToMaturity: years === null ? null : Math.round(years * 100) / 100,
    currentYield:
      annualCoupon && bond.price && bond.price > 0
        ? Math.round((annualCoupon / bond.price) * 100 * 100) / 100
        : null,
    yieldToMaturity: yieldToMaturity(bond.price, bond.faceValue, bond.couponRate, bond.maturity, now),
    ratingGrade: ratingGrade(bond.creditRating),
  };
}

export async function bondDataset(): Promise<BondRow[]> {
  return cached('bonds:dataset', DATASET_TTL_MS, async () => {
    const now = new Date();
    const [corporate, gsec] = await Promise.all([fetchBonds('corporate'), fetchBonds('gsec')]);
    return [...corporate, ...gsec].map((bond) => decorate(bond, now));
  });
}

export type BondSort = 'yieldToMaturity' | 'currentYield' | 'couponRate' | 'yearsToMaturity' | 'symbol';

export interface BondQuery {
  q?: string;
  segment?: BondSegment;
  rating?: string;
  maturity?: 'under1' | '1to3' | '3to5' | '5to10' | 'over10';
  tradedOnly?: boolean;
  sort?: BondSort;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const MATURITY_BANDS: Record<string, [number, number]> = {
  under1: [0, 1],
  '1to3': [1, 3],
  '3to5': [3, 5],
  '5to10': [5, 10],
  over10: [10, Infinity],
};

export interface BondResult {
  bonds: BondRow[];
  total: number;
  page: number;
  limit: number;
  ratings: string[];
  counts: { corporate: number; gsec: number; tradedToday: number };
}

export async function listBonds(query: BondQuery): Promise<BondResult> {
  const rows = await bondDataset();
  const needle = query.q?.trim().toLowerCase();
  const band = query.maturity ? MATURITY_BANDS[query.maturity] : null;

  const filtered = rows.filter((bond) => {
    if (query.segment && bond.segment !== query.segment) return false;
    if (query.rating && bond.ratingGrade !== query.rating) return false;
    if (query.tradedOnly && !bond.tradedToday) return false;
    if (band) {
      if (bond.yearsToMaturity === null) return false;
      if (bond.yearsToMaturity < band[0] || bond.yearsToMaturity >= band[1]) return false;
    }
    if (needle && !bond.symbol.toLowerCase().includes(needle) && !(bond.isin ?? '').toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });

  const sort = query.sort ?? 'yieldToMaturity';
  const dir = query.dir ?? 'desc';

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'symbol') {
      return dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
    }
    const left = a[sort];
    const right = b[sort];
    // A bond we could not price ranks last rather than posing as a zero yield.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return dir === 'asc' ? left - right : right - left;
  });

  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * limit;

  return {
    bonds: sorted.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    ratings: [...new Set(rows.map((bond) => bond.ratingGrade).filter((grade): grade is string => Boolean(grade)))].sort(),
    counts: {
      corporate: rows.filter((bond) => bond.segment === 'corporate').length,
      gsec: rows.filter((bond) => bond.segment === 'gsec').length,
      tradedToday: rows.filter((bond) => bond.tradedToday).length,
    },
  };
}
