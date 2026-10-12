import { isDatabaseConnected } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { cached } from '../market/market.cache.js';
import { FundScheme } from './fund.model.js';
import { ensureFundUniverse } from './fund.service.js';
import { annualisedReturn, navOn } from './navHistory.service.js';

/** The whole universe with its returns is one object; rebuilding it hourly is cheap and keeps sorting honest. */
const DATASET_TTL_MS = 60 * 60_000;

export interface FundRow {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  plan: string | null;
  option: string | null;
  nav: number;
  navDate: string;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
}

export type FundSort = 'return1y' | 'return3y' | 'return5y' | 'nav' | 'name';

export interface FundQuery {
  q?: string;
  category?: string;
  fundHouse?: string;
  plan?: 'Direct' | 'Regular';
  sort?: FundSort;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

function yearsAgo(years: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()));
}

async function buildDataset(): Promise<FundRow[]> {
  await ensureFundUniverse();

  const [schemes, y1, y3, y5] = await Promise.all([
    FundScheme.find({}, 'schemeCode name fundHouse category plan option nav navDate').lean(),
    navOn(yearsAgo(1)),
    navOn(yearsAgo(3)),
    navOn(yearsAgo(5)),
  ]);

  return schemes.map((scheme) => ({
    schemeCode: scheme.schemeCode,
    name: scheme.name,
    fundHouse: scheme.fundHouse,
    category: scheme.category,
    plan: scheme.plan,
    option: scheme.option,
    nav: scheme.nav,
    navDate: scheme.navDate.toISOString(),
    return1y: annualisedReturn(y1.get(scheme.schemeCode), scheme.nav, 1),
    return3y: annualisedReturn(y3.get(scheme.schemeCode), scheme.nav, 3),
    return5y: annualisedReturn(y5.get(scheme.schemeCode), scheme.nav, 5),
  }));
}

export async function fundDataset(): Promise<FundRow[]> {
  if (!isDatabaseConnected()) throw ApiError.badRequest('Mutual fund data needs the database to be connected.');
  return cached('fund-explorer:dataset', DATASET_TTL_MS, buildDataset);
}

export interface FundExploreResult {
  funds: FundRow[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
  fundHouses: string[];
}

export async function exploreFunds(query: FundQuery): Promise<FundExploreResult> {
  const rows = await fundDataset();

  const needle = query.q?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (query.category && row.category !== query.category) return false;
    if (query.fundHouse && row.fundHouse !== query.fundHouse) return false;
    // AMFI writes these as "Direct Plan" / "Regular Plan", so match the leading word.
    if (query.plan && !(row.plan ?? '').toLowerCase().startsWith(query.plan.toLowerCase())) return false;
    if (needle && !row.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const sort = query.sort ?? 'return1y';
  const dir = query.dir ?? 'desc';

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') {
      return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }

    const left = a[sort];
    const right = b[sort];
    // A scheme too young to have the figure ranks last either way, rather than posing as a zero.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return dir === 'asc' ? left - right : right - left;
  });

  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * limit;

  return {
    funds: sorted.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    categories: [...new Set(rows.map((row) => row.category))].sort(),
    fundHouses: [...new Set(rows.map((row) => row.fundHouse))].sort(),
  };
}

export interface FundDetail extends FundRow {
  /** Where the scheme sits among its own category on three-year return, best first. */
  categoryRank: number | null;
  categorySize: number;
  /** The median three-year return of its category, for a sense of what "good" looks like here. */
  categoryMedian3y: number | null;
}

export async function fundDetail(schemeCode: string): Promise<FundDetail | null> {
  const rows = await fundDataset();
  const row = rows.find((entry) => entry.schemeCode === schemeCode);
  if (!row) return null;

  // Rank against the schemes an investor would actually be choosing between: same category, and
  // only those with a three-year record to compare on.
  const peers = rows.filter((entry) => entry.category === row.category && entry.return3y !== null);
  const ranked = [...peers].sort((a, b) => (b.return3y ?? 0) - (a.return3y ?? 0));
  const index = ranked.findIndex((entry) => entry.schemeCode === schemeCode);

  const middle = ranked.length ? ranked[Math.floor((ranked.length - 1) / 2)].return3y : null;

  return {
    ...row,
    categoryRank: index >= 0 ? index + 1 : null,
    categorySize: ranked.length,
    categoryMedian3y: middle,
  };
}
