import { logger } from '../../config/logger.js';
import { cached } from '../market/market.cache.js';
import type { IpoBoard } from './ipo.types.js';

/**
 * IPO data comes from two very different places, and they are kept apart deliberately:
 *
 *  - NSE's public endpoints are the official record: which issues are open, and how many times each
 *    investor category has bid. Authoritative, but it says nothing about what the market expects.
 *  - The grey market premium is an unofficial, unregulated quote published by IPO trackers. It is
 *    the number people actually apply on, so it is worth showing — but never as fact.
 *
 * Neither is ever allowed to fail the request: the page degrades to whichever half answered.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NSE_BASE = 'https://www.nseindia.com/api';
const GMP_URL = 'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/';

const TIMEOUT_MS = 12_000;

export const IPO_TTL = {
  /** Subscription moves through the day while an issue is open. */
  live: 5 * 60_000,
  gmp: 15 * 60_000,
  past: 6 * 60 * 60_000,
} as const;

async function fetchText(url: string, accept: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': BROWSER_UA, accept, 'accept-language': 'en-US,en;q=0.9' },
    });

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function nse<T>(path: string): Promise<T> {
  const body = await fetchText(`${NSE_BASE}${path}`, 'application/json, text/plain, */*');
  return JSON.parse(body) as T;
}

/** Every source is optional. A failure is logged and reported as absent, never thrown at the user. */
async function optional<T>(label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    logger.warn(`IPO source unavailable: ${label}`, { error: (error as Error).message });
    return null;
  }
}

export interface NseUpcoming {
  companyName: string;
  symbol: string;
  issueStartDate: string;
  issueEndDate: string;
  issuePrice: string;
  issueSize: string;
  status: string;
  series: string;
}

export interface NseCurrent extends NseUpcoming {
  category: string | null;
  noOfTime: string | null;
  noOfSharesOffered: string | null;
  noOfsharesBid: string | null;
}

export interface NsePast {
  company: string;
  symbol: string;
  ipoStartDate: string;
  ipoEndDate: string;
  issuePrice: string;
  priceRange: string;
  listingDate: string;
  securityType: string;
}

export interface NseCategoryRow {
  category: string;
  noOfShareOffered: string;
  noOfSharesBid: string;
  noOfTotalMeant: string;
  srNo: string;
}

export const fetchUpcoming = () =>
  optional('nse upcoming', () =>
    cached('ipo:nse:upcoming', IPO_TTL.live, () => nse<NseUpcoming[]>('/all-upcoming-issues?category=ipo')),
  );

export const fetchCurrent = () =>
  optional('nse current', () =>
    cached('ipo:nse:current', IPO_TTL.live, () => nse<NseCurrent[]>('/ipo-current-issue')),
  );

export const fetchPast = () =>
  optional('nse past', () =>
    cached('ipo:nse:past', IPO_TTL.past, () => nse<NsePast[]>('/public-past-issues')),
  );

export const fetchCategoryBreakdown = (symbol: string) =>
  optional(`nse categories ${symbol}`, () =>
    cached(`ipo:nse:categories:${symbol}`, IPO_TTL.live, async () => {
      const body = await nse<{ dataList: NseCategoryRow[] }>(
        `/ipo-active-category?symbol=${encodeURIComponent(symbol)}`,
      );
      // The first row repeats the column headings rather than carrying data.
      return (body.dataList ?? []).filter((row) => row.srNo && row.srNo !== 'Sr.No.');
    }),
  );

// --- Grey market -------------------------------------------------------------------------------

export interface GmpRow {
  name: string;
  board: IpoBoard;
  premium: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  priceBand: number | null;
  estimatedListing: number | null;
  estimatedGainPercent: number | null;
  dates: string | null;
  status: string | null;
  updatedAt: string | null;
}

export interface GmpHistoryRow {
  name: string;
  issuePrice: number;
  gmp: number;
  listingPrice: number;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8377;|₹/g, '')
    .trim();
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function tableRows(table: string): string[][] {
  return (table.match(/<tr[\s\S]*?<\/tr>/g) ?? [])
    .map((row) => (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) ?? []).map(stripTags))
    .filter((cells) => cells.length > 0);
}

function readTrend(cell: string): 'up' | 'down' | 'flat' | null {
  if (cell.includes('🟢')) return 'up';
  if (cell.includes('🔴')) return 'down';
  if (cell.includes('🟡')) return 'flat';
  return null;
}

interface GmpScrape {
  live: GmpRow[];
  history: GmpHistoryRow[];
  fetchedAt: string;
}

/**
 * The tracker publishes three tables: mainboard live, SME live, and a long archive of past issues
 * carrying the GMP each one showed alongside the price it actually listed at. The archive is what
 * makes it possible to say how much a given GMP has historically been worth.
 */
function parseGmpPage(html: string): GmpScrape {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  const live: GmpRow[] = [];
  const history: GmpHistoryRow[] = [];

  tables.forEach((table, index) => {
    const rows = tableRows(table);
    const header = rows[0]?.join(' ').toLowerCase() ?? '';
    const isLive = header.includes('price band') && header.includes('status');
    const isHistory = header.includes('listing price');

    for (const cells of rows.slice(1)) {
      if (isLive && cells.length >= 7) {
        const gain = /\(([-\d.]+)%\)/.exec(cells[4] ?? '');
        live.push({
          name: cells[0] ?? '',
          // Mainboard is published first, SME second.
          board: index === 0 ? 'mainboard' : 'sme',
          premium: toNumber(cells[1] ?? ''),
          trend: readTrend(cells[2] ?? ''),
          priceBand: toNumber(cells[3] ?? ''),
          estimatedListing: toNumber((cells[4] ?? '').split('(')[0] ?? ''),
          estimatedGainPercent: gain ? Number(gain[1]) : null,
          dates: cells[5] ?? null,
          status: cells[6] ?? null,
          updatedAt: cells[7] ?? null,
        });
        continue;
      }

      if (isHistory && cells.length >= 4) {
        const issuePrice = toNumber(cells[1] ?? '');
        const gmp = toNumber(cells[2] ?? '');
        const listingPrice = toNumber(cells[3] ?? '');
        if (issuePrice && issuePrice > 0 && gmp !== null && listingPrice && listingPrice > 0) {
          history.push({ name: cells[0] ?? '', issuePrice, gmp, listingPrice });
        }
      }
    }
  });

  return { live, history, fetchedAt: new Date().toISOString() };
}

export const fetchGmp = () =>
  optional('grey market premium', () =>
    cached('ipo:gmp', IPO_TTL.gmp, async () => parseGmpPage(await fetchText(GMP_URL, 'text/html'))),
  );

export const GMP_SOURCE = 'ipowatch.in (grey market, unofficial)';
export const NSE_SOURCE = 'NSE India';
