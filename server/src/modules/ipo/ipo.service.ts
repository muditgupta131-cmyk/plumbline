import { ApiError } from '../../utils/ApiError.js';
import { isoDayMonthYear } from '../../utils/dates.js';
import {
  fetchCategoryBreakdown,
  fetchCurrent,
  fetchGmp,
  fetchPast,
  fetchUpcoming,
  GMP_SOURCE,
  NSE_SOURCE,
  type GmpHistoryRow,
  type GmpRow,
  type NseCategoryRow,
} from './ipo.sources.js';
import type {
  GmpBaseRate,
  IpoAnalysis,
  IpoCalibration,
  IpoDetail,
  IpoGmp,
  IpoSignal,
  IpoStatus,
  IpoSubscription,
  IpoSubscriptionCategory,
  IpoSummary,
} from './ipo.types.js';

/** NSE writes the band as free text: "Rs.118 to Rs.124", sometimes a single price. */
function parsePriceBand(value: string | null | undefined): { min: number | null; max: number | null; label: string | null } {
  if (!value) return { min: null, max: null, label: null };
  const numbers = (value.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (!numbers.length) return { min: null, max: null, label: value.trim() || null };
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    label: value.trim(),
  };
}

const NAME_NOISE = /\b(limited|ltd|private|pvt|india|indian|the|company|co|corporation|corp|industries|enterprises)\b/g;

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(NAME_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * The exchange and the grey market tracker name the same company differently ("Pranav Constructions
 * Limited" against "Pranav Constructions"), so they are matched on significant words rather than
 * string equality. A single shared word is not enough to claim a match.
 */
function matchGmpRow(name: string, rows: GmpRow[]): GmpRow | null {
  const target = normaliseName(name);
  if (!target) return null;

  const targetWords = target.split(' ').filter((word) => word.length > 2);
  let best: { row: GmpRow; score: number } | null = null;

  for (const row of rows) {
    const candidate = normaliseName(row.name);
    if (!candidate) continue;

    let score = 0;
    if (candidate === target) score = 100;
    else if (target.startsWith(candidate) || candidate.startsWith(target)) score = 80;
    else {
      const words = candidate.split(' ').filter((word) => word.length > 2);
      const shared = words.filter((word) => targetWords.includes(word)).length;
      const coverage = shared / Math.max(1, Math.min(words.length, targetWords.length));
      // Demand both a real proportion and more than one word, so "India Ltd" style overlap fails.
      if (coverage >= 0.6 && shared >= 2) score = 40 + coverage * 20;
    }

    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }

  return best?.row ?? null;
}

function toGmp(row: GmpRow | null, issuePrice: number | null): IpoGmp | null {
  if (!row || row.premium === null) return null;

  const reference = issuePrice ?? row.priceBand;
  // Without an issue price a premium cannot be expressed as a percentage. The tracker prints 0.00%
  // in that case, which would otherwise read as "no premium" when there plainly is one.
  const quoted = row.estimatedGainPercent && row.estimatedGainPercent !== 0 ? row.estimatedGainPercent : null;

  return {
    premium: row.premium,
    premiumPercent: reference && reference > 0 ? Math.round((row.premium / reference) * 1000) / 10 : quoted,
    estimatedListing: row.estimatedListing ?? (reference ? reference + row.premium : null),
    trend: row.trend,
    updatedAt: row.updatedAt,
    source: GMP_SOURCE,
  };
}

// --- Calibration -------------------------------------------------------------------------------

const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: 'No premium', min: -1e9, max: 0.001 },
  { label: '0-10%', min: 0.001, max: 10 },
  { label: '10-20%', min: 10, max: 20 },
  { label: '20-35%', min: 20, max: 35 },
  { label: '35-60%', min: 35, max: 60 },
  { label: 'Over 60%', min: 60, max: 1e9 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round((value ?? 0) * 10) / 10;
}

function bandFor(premiumPercent: number): string {
  return BANDS.find((band) => premiumPercent >= band.min && premiumPercent < band.max)?.label ?? 'No premium';
}

/**
 * Measures what the grey market has actually been worth: for each premium band, what past issues in
 * that band really did on listing day. This is the difference between quoting a rumour and pricing it.
 */
export function buildCalibration(history: GmpHistoryRow[]): IpoCalibration | null {
  const points = history
    .map((row) => ({
      predicted: (row.gmp / row.issuePrice) * 100,
      actual: ((row.listingPrice - row.issuePrice) / row.issuePrice) * 100,
    }))
    .filter((point) => Number.isFinite(point.predicted) && Number.isFinite(point.actual));

  if (points.length < 30) return null;

  const bands: GmpBaseRate[] = [];

  for (const band of BANDS) {
    const group = points.filter((point) => point.predicted >= band.min && point.predicted < band.max);
    if (group.length < 5) continue;

    bands.push({
      band: band.label,
      sampleSize: group.length,
      medianActual: median(group.map((point) => point.actual)),
      positiveRate: Math.round((group.filter((point) => point.actual > 0).length / group.length) * 100),
      medianGmpError: median(group.map((point) => point.actual - point.predicted)),
    });
  }

  return {
    sampleSize: points.length,
    directionalAccuracy: Math.round(
      (points.filter((point) => point.predicted > 0 === point.actual > 0).length / points.length) * 100,
    ),
    medianGmpError: median(points.map((point) => point.actual - point.predicted)),
    bands,
    updatedAt: new Date().toISOString(),
  };
}

// --- Subscription ------------------------------------------------------------------------------

function categoryKey(label: string): IpoSubscriptionCategory['key'] | null {
  const text = label.toLowerCase();
  if (text.includes('qualified institutional')) return 'qib';
  if (text.includes('retail individual')) return 'rii';
  if (text.includes('employee')) return 'employee';
  if (text.includes('non institutional')) return 'nii';
  return null;
}

function toSubscription(rows: NseCategoryRow[] | null, fallbackTotal: number | null): IpoSubscription | null {
  if (!rows?.length && fallbackTotal === null) return null;

  const categories: IpoSubscriptionCategory[] = [];
  let total = fallbackTotal;

  for (const row of rows ?? []) {
    const times = Number(row.noOfTotalMeant);
    if (/^total$/i.test(row.category.trim())) {
      if (Number.isFinite(times)) total = Math.round(times * 100) / 100;
      continue;
    }

    // NSE nests each category's brackets underneath it ("2" is all NII, "2.1" the above-₹10-lakh
    // slice, "2.1(a)" corporates within that). Only the top-level rows are the book itself.
    if (!/^\d+$/.test(row.srNo.trim())) continue;

    const key = categoryKey(row.category);
    if (!key || !Number.isFinite(times) || !row.noOfTotalMeant) continue;

    categories.push({
      label: row.category.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      key,
      times: Math.round(times * 100) / 100,
      offered: Number(row.noOfShareOffered) || null,
      bid: Number(row.noOfSharesBid) || null,
    });
  }

  if (!categories.length && total === null) return null;
  return { total, categories, source: NSE_SOURCE };
}

// --- Analysis ----------------------------------------------------------------------------------

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * A deterministic read, so the same inputs always produce the same verdict. Grey market premium is
 * scored through the historical base rate rather than at face value, and demand is weighted towards
 * institutional money, which does its own diligence.
 */
export function analyse(ipo: IpoSummary, calibration: IpoCalibration | null): IpoAnalysis {
  const signals: IpoSignal[] = [];
  const caveats: string[] = [];
  const parts: Array<{ value: number; weight: number }> = [];

  const premiumPercent = ipo.gmp?.premiumPercent ?? null;

  if (premiumPercent !== null) {
    const band = calibration?.bands.find((entry) => entry.band === bandFor(premiumPercent)) ?? null;

    if (band) {
      const expected = band.medianActual;
      signals.push({
        label: 'Grey market premium',
        verdict: expected >= 15 ? 'strong' : expected >= 4 ? 'fair' : 'weak',
        detail:
          `₹${ipo.gmp?.premium} (${premiumPercent}% over issue price). Past issues in this band listed ` +
          `${band.medianActual > 0 ? '+' : ''}${band.medianActual}% on median and were positive ` +
          `${band.positiveRate}% of the time (${band.sampleSize} issues).`,
      });
      parts.push({ value: Math.max(0, Math.min(100, 50 + expected * 1.6)), weight: 3 });
    } else {
      signals.push({
        label: 'Grey market premium',
        verdict: premiumPercent >= 15 ? 'strong' : premiumPercent > 0 ? 'fair' : 'weak',
        detail: `₹${ipo.gmp?.premium} (${premiumPercent}% over issue price). No comparable history to price it against.`,
      });
      parts.push({ value: Math.max(0, Math.min(100, 50 + premiumPercent * 1.2)), weight: 2 });
    }

    if (calibration) {
      caveats.push(
        `Grey market premium has pointed the right way ${calibration.directionalAccuracy}% of the time, ` +
          `but overstated the gain by ${Math.abs(calibration.medianGmpError)} points on median.`,
      );
    }
  } else {
    signals.push({
      label: 'Grey market premium',
      verdict: 'unknown',
      detail: 'No grey market quote found for this issue.',
    });
  }

  const total = ipo.subscription?.total ?? null;
  if (total !== null) {
    signals.push({
      label: 'Overall subscription',
      verdict: total >= 10 ? 'strong' : total >= 2 ? 'fair' : 'weak',
      detail: `The book is covered ${total}× so far.`,
    });
    parts.push({ value: Math.max(0, Math.min(100, 30 + Math.log10(Math.max(total, 0.1) + 1) * 55)), weight: 2 });
  }

  const qib = ipo.subscription?.categories.find((entry) => entry.key === 'qib');
  if (qib) {
    signals.push({
      label: 'Institutional demand (QIB)',
      verdict: qib.times >= 5 ? 'strong' : qib.times >= 1 ? 'fair' : 'weak',
      detail:
        `Institutions have bid ${qib.times}× their reserved portion` +
        (qib.times < 1 ? ' — the part of the book that does the deepest diligence is undersubscribed.' : '.'),
    });
    parts.push({ value: Math.max(0, Math.min(100, 25 + Math.log10(Math.max(qib.times, 0.1) + 1) * 60)), weight: 2 });
  }

  const rii = ipo.subscription?.categories.find((entry) => entry.key === 'rii');
  if (rii) {
    signals.push({
      label: 'Retail demand',
      verdict: rii.times >= 3 ? 'strong' : rii.times >= 1 ? 'fair' : 'weak',
      detail:
        `Retail has bid ${rii.times}× its portion` +
        (rii.times > 1 ? ` — expect allotment by lottery, not in full.` : '.'),
    });
  }

  if (ipo.status === 'open' && ipo.closeDate) {
    const left = daysBetween(new Date(), new Date(ipo.closeDate));
    signals.push({
      label: 'Time to apply',
      verdict: left >= 1 ? 'fair' : 'weak',
      detail: left <= 0 ? 'Applications close today.' : `${left} day${left === 1 ? '' : 's'} left to apply.`,
    });
  }

  if (ipo.board === 'sme') {
    caveats.push('SME issues are thinly traded with large lot sizes, so listing moves are far wider in both directions.');
  }
  caveats.push('The grey market is unofficial and unregulated. Nothing here is a recommendation to apply.');

  const weightTotal = parts.reduce((sum, part) => sum + part.weight, 0);
  if (!weightTotal) {
    return {
      score: null,
      stance: 'insufficient',
      headline: 'Not enough data yet to judge this issue.',
      signals,
      caveats,
    };
  }

  const score = Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weightTotal);
  // A score built only from a grey market quote is a thin basis for a verdict; say so rather than implying rigour.
  const thin = weightTotal <= 3;

  let stance: IpoAnalysis['stance'] = thin ? 'consider' : score >= 68 ? 'apply' : score >= 48 ? 'consider' : 'avoid';

  // Never say "apply" over the top of an undersubscribed institutional book. A strong grey market
  // quote can outweigh it arithmetically, but the two disagreeing is the signal worth respecting.
  if (stance === 'apply' && qib && qib.times < 1) {
    stance = 'consider';
    caveats.push(
      'The grey market is pricing a gain that institutional investors are not bidding for. When those two disagree, the book is the harder evidence.',
    );
  }

  const headline =
    stance === 'apply'
      ? 'Demand and grey market pricing both point to a positive listing.'
      : stance === 'avoid'
        ? 'The signals available do not support applying for a listing gain.'
        : qib && qib.times < 1 && score >= 68
          ? 'The grey market is bullish, but institutions have not filled their portion.'
          : 'A mixed picture — worth a look, but not a clear call.';

  return { score, stance, headline, signals, caveats };
}

// --- Assembly ----------------------------------------------------------------------------------

function statusFor(open: string | null, close: string | null, listing: string | null, raw?: string): IpoStatus {
  const now = Date.now();
  if (listing && new Date(listing).getTime() < now) return 'listed';
  if (open && close) {
    const from = new Date(open).getTime();
    // The close date is inclusive, so an issue stays open until the end of that day.
    const to = new Date(close).getTime() + 86_400_000;
    if (now >= from && now < to) return 'open';
    if (now < from) return 'upcoming';
    return 'closed';
  }
  if (raw && /active/i.test(raw)) return 'open';
  if (raw && /forthcoming|upcoming/i.test(raw)) return 'upcoming';
  return 'closed';
}

async function collect(): Promise<{ summaries: IpoSummary[]; calibration: IpoCalibration | null }> {
  const [upcoming, current, past, gmp] = await Promise.all([
    fetchUpcoming(),
    fetchCurrent(),
    fetchPast(),
    fetchGmp(),
  ]);

  const gmpRows = gmp?.live ?? [];
  const calibration = gmp ? buildCalibration(gmp.history) : null;
  const byKey = new Map<string, IpoSummary>();

  const add = (summary: IpoSummary) => {
    const existing = byKey.get(summary.slug);
    // Keep the richer record when the same issue appears in more than one feed.
    if (!existing || (summary.subscription && !existing.subscription)) byKey.set(summary.slug, summary);
  };

  const build = (
    name: string,
    symbol: string | null,
    priceLabel: string | null,
    sizeRaw: string | null,
    openRaw: string | null,
    closeRaw: string | null,
    listingRaw: string | null,
    rawStatus?: string,
    total?: number | null,
  ): IpoSummary => {
    const openDate = isoDayMonthYear(openRaw);
    const closeDate = isoDayMonthYear(closeRaw);
    const listingDate = isoDayMonthYear(listingRaw);
    const matched = matchGmpRow(name, gmpRows);

    // NSE leaves the band blank on some issues; the tracker usually still carries the cut-off price.
    let priceBand = parsePriceBand(priceLabel);
    if (priceBand.max === null && matched?.priceBand) {
      priceBand = { min: matched.priceBand, max: matched.priceBand, label: `₹${matched.priceBand}` };
    }

    return {
      symbol,
      slug: symbol ? symbol.toLowerCase() : slugify(name),
      name: name.trim(),
      board: matched?.board ?? 'mainboard',
      status: statusFor(openDate, closeDate, listingDate, rawStatus),
      priceBand,
      issueSize: sizeRaw && Number(sizeRaw) ? Number(sizeRaw) : null,
      openDate,
      closeDate,
      listingDate,
      dateLabel: openDate && closeDate ? null : (matched?.dates ?? null),
      gmp: toGmp(matched, priceBand.max),
      subscription: total !== undefined && total !== null ? { total, categories: [], source: NSE_SOURCE } : null,
    };
  };

  for (const row of current ?? []) {
    if (row.category && !/^total$/i.test(row.category)) continue;
    const times = Number(row.noOfTime);
    add(
      build(
        row.companyName,
        row.symbol,
        row.issuePrice,
        row.issueSize,
        row.issueStartDate,
        row.issueEndDate,
        null,
        row.status,
        Number.isFinite(times) ? Math.round(times * 100) / 100 : null,
      ),
    );
  }

  for (const row of upcoming ?? []) {
    add(build(row.companyName, row.symbol, row.issuePrice, row.issueSize, row.issueStartDate, row.issueEndDate, null, row.status));
  }

  for (const row of (past ?? []).slice(0, 40)) {
    add(
      build(
        row.company,
        row.symbol,
        row.priceRange ?? row.issuePrice,
        null,
        row.ipoStartDate,
        row.ipoEndDate,
        row.listingDate,
      ),
    );
  }

  // Issues the exchange has not published yet still show a grey market quote; surface them as upcoming.
  for (const row of gmpRows) {
    const slug = slugify(row.name);
    if (byKey.has(slug)) continue;
    if ([...byKey.values()].some((entry) => matchGmpRow(entry.name, [row]))) continue;

    byKey.set(slug, {
      symbol: null,
      slug,
      name: row.name,
      board: row.board,
      status: /open/i.test(row.status ?? '') ? 'open' : /closed/i.test(row.status ?? '') ? 'closed' : 'upcoming',
      priceBand: { min: row.priceBand, max: row.priceBand, label: row.priceBand ? `₹${row.priceBand}` : null },
      issueSize: null,
      openDate: null,
      closeDate: null,
      listingDate: null,
      dateLabel: row.dates,
      gmp: toGmp(row, row.priceBand),
      subscription: null,
    });
  }

  const order: Record<IpoStatus, number> = { open: 0, upcoming: 1, closed: 2, listed: 3 };
  const summaries = [...byKey.values()].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (a.openDate ?? '').localeCompare(b.openDate ?? '');
  });

  return { summaries, calibration };
}

export async function listIpos(): Promise<{ ipos: IpoSummary[]; calibration: IpoCalibration | null }> {
  const { summaries, calibration } = await collect();
  if (!summaries.length) throw ApiError.upstream('No IPO data is available right now. Try again shortly.');
  return { ipos: summaries, calibration };
}

export async function getIpo(slug: string): Promise<IpoDetail> {
  const { summaries, calibration } = await collect();
  const needle = slug.toLowerCase();
  const found = summaries.find((entry) => entry.slug === needle);
  if (!found) throw ApiError.notFound('That IPO could not be found.');

  const summary = { ...found };

  // The per-category book is only published while an issue is live, and only for listed symbols.
  if (summary.symbol && (summary.status === 'open' || summary.status === 'closed')) {
    const detailed = toSubscription(await fetchCategoryBreakdown(summary.symbol), summary.subscription?.total ?? null);
    if (detailed) summary.subscription = detailed;
  }

  return {
    ...summary,
    analysis: analyse(summary, calibration),
    calibration,
    sources: {
      listing: NSE_SOURCE,
      gmp: summary.gmp ? GMP_SOURCE : null,
      subscription: summary.subscription ? NSE_SOURCE : null,
    },
  };
}
