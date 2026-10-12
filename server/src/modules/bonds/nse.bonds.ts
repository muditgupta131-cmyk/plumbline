import { logger } from '../../config/logger.js';
import { parseDayMonthYear } from '../../utils/dates.js';

/**
 * NSE publishes its traded debt list without a key. Two caveats shape everything downstream: the
 * exchange's own `bYield` column is zero on every row, so yield has to be computed here, and most
 * bonds do not trade on a given day, so a "price" is usually the last close rather than a live quote.
 */
const BASE = 'https://www.nseindia.com/api/liveBonds-traded-on-cm';
const FETCH_TIMEOUT_MS = 45_000;

export type BondSegment = 'corporate' | 'gsec';

export interface RawBond {
  symbol: string;
  isin: string | null;
  couponRate: number | null;
  maturity: Date | null;
  creditRating: string | null;
  ratingAgency: string | null;
  faceValue: number | null;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  volume: number | null;
  series: string | null;
  segment: BondSegment;
  /** False when the bond did not trade today, so the price is a carried-forward close. */
  tradedToday: boolean;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== '-' ? trimmed : null;
}

export function parseBonds(payload: unknown, segment: BondSegment): RawBond[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : [];

  const bonds: RawBond[] = [];

  for (const entry of rows as Array<Record<string, unknown>>) {
    const symbol = text(entry.symbol);
    if (!symbol) continue;

    const lastTraded = num(entry.ltP);
    const close = num(entry.close ?? entry.closePrice ?? entry.lastPrice);
    const volume = num(entry.qty ?? entry.totalTradedVolume);

    bonds.push({
      symbol,
      isin: text(entry.isin),
      couponRate: num(entry.coupr),
      maturity: parseDayMonthYear(entry.maturity_date),
      creditRating: text(entry.credit_rating),
      ratingAgency: text(entry.rating_agency),
      faceValue: num(entry.face_value),
      // Most rows have no traded price; the close is what the exchange carried forward.
      price: lastTraded && lastTraded > 0 ? lastTraded : close,
      previousClose: close,
      changePercent: num(entry.per ?? entry.pChange),
      volume,
      series: text(entry.series),
      segment,
      tradedToday: Boolean(volume && volume > 0),
    });
  }

  return bonds;
}

export async function fetchBonds(segment: BondSegment): Promise<RawBond[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}?type=${segment === 'gsec' ? 'gsec' : 'bonds'}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
    });
    if (!response.ok) throw new Error(`NSE responded ${response.status}`);
    return parseBonds(await response.json(), segment);
  } catch (error) {
    logger.warn('NSE bond feed failed', {
      segment,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
