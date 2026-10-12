import { isDatabaseConnected } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { cached, TTL } from '../market/market.cache.js';
import { FundScheme } from './fund.model.js';
import { fundUniverseAge, refreshFundUniverse } from './amfi.service.js';

const HISTORY_URL = 'https://api.mfapi.in/mf';

export interface FundMatch {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  plan: string | null;
  option: string | null;
  isin: string | null;
  nav: number;
  navDate: string;
}

export interface FundNavPoint {
  t: string;
  nav: number;
}

const ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

/**
 * Only ever block on the AMFI download when there is nothing to serve. Once the universe
 * exists, refresh in the background so the first request after a restart is not held behind
 * a 1.5 MB download and 14k upserts.
 */
export async function ensureFundUniverse(): Promise<void> {
  if (!isDatabaseConnected()) return;

  const count = await FundScheme.estimatedDocumentCount();

  if (count === 0) {
    await refreshFundUniverse(true);
    return;
  }

  void refreshFundUniverse();
}

function toMatch(document: {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  plan: string | null;
  option: string | null;
  isin: string | null;
  nav: number;
  navDate: Date;
}): FundMatch {
  return {
    schemeCode: document.schemeCode,
    name: document.name,
    fundHouse: document.fundHouse,
    category: document.category,
    plan: document.plan,
    option: document.option,
    isin: document.isin,
    nav: document.nav,
    navDate: document.navDate.toISOString(),
  };
}

const STOPWORDS = new Set([
  'fund',
  'funds',
  'plan',
  'direct',
  'regular',
  'growth',
  'option',
  'idcw',
  'dividend',
  'payout',
  'reinvestment',
  'scheme',
  'the',
  'of',
  'and',
]);

interface QueryShape {
  words: string[];
  distinctive: string[];
  house: string | null;
  wantsDirect: boolean;
  wantsRegular: boolean;
  wantsGrowth: boolean;
  wantsIdcw: boolean;
  wantsPassive: boolean;
  wantsActive: boolean;
}

// SEBI's 2024-25 scheme renaming means broker statements still carry names AMFI no longer lists.
const RENAME_HINTS: Record<string, string[]> = {
  bluechip: ['large', 'cap'],
  opportunities: [],
  prudence: ['balanced', 'advantage'],
  focused25: ['focused'],
};

function shapeQuery(needle: string): QueryShape {
  const words = needle.split(/[^a-z0-9]+/i).filter((word) => word.length > 1);
  const distinctive = words
    .filter((word) => !STOPWORDS.has(word))
    .flatMap((word) => (word in RENAME_HINTS ? RENAME_HINTS[word] : [word]));

  return {
    words,
    distinctive,
    house: distinctive[0] ?? words[0] ?? null,
    wantsDirect: words.includes('direct'),
    wantsRegular: words.includes('regular'),
    wantsGrowth: words.includes('growth'),
    wantsIdcw: words.includes('idcw') || words.includes('dividend'),
    wantsPassive: words.includes('passive'),
    wantsActive: words.includes('active'),
  };
}

function score(match: FundMatch, shape: QueryShape): number {
  const name = match.name.toLowerCase();

  // The fund house is the strongest signal: an HDFC statement line must not resolve to an ICICI scheme.
  if (shape.house && !name.includes(shape.house)) return -100;

  const targets = shape.distinctive.length ? shape.distinctive : shape.words;
  const hits = targets.filter((word) => name.includes(word)).length;
  let value = targets.length ? (hits / targets.length) * 70 : 0;

  const isDirect = /direct/.test(name);
  const isGrowth = /growth/.test(name);
  const isIdcw = /idcw|dividend/.test(name);

  if (shape.wantsDirect) value += isDirect ? 12 : -14;
  if (shape.wantsRegular) value += isDirect ? -14 : 12;
  if (shape.wantsGrowth) value += isGrowth ? 10 : -12;
  if (shape.wantsIdcw) value += isIdcw ? 10 : -12;

  // "Active" and "Passive" are opposite strategies that AMFI often runs under otherwise identical names
  // (ICICI's Dynamic Asset Allocation Active FOF and Passive FOF differ by that one word). Missing the
  // word is a small miss; carrying the opposite word is a different fund, so it must not win.
  const isPassive = /\bpassive\b/.test(name);
  const isActive = /\bactive\b/.test(name);
  if (shape.wantsPassive) value += isPassive ? 12 : isActive ? -60 : -8;
  if (shape.wantsActive) value += isActive ? 12 : isPassive ? -60 : -8;
  if (!shape.wantsIdcw && !shape.wantsGrowth && isGrowth) value += 3;

  // Prefer the tightest name that still covers the query.
  value -= Math.min(10, name.length / 12);

  return value;
}

export async function searchFunds(query: string, limit = 10): Promise<FundMatch[]> {
  if (!isDatabaseConnected()) throw ApiError.badRequest('Mutual fund data needs the database to be connected.');

  await ensureFundUniverse();

  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  // Statements repeat the same scheme on every SIP instalment, so cache by query.
  return cached(`fund-search:${needle}:${limit}`, TTL.search, () => runFundSearch(needle, limit));
}

async function runFundSearch(needle: string, limit: number): Promise<FundMatch[]> {

  const shape = shapeQuery(needle);
  if (!shape.house) return [];

  const toCondition = (word: string) => ({ searchName: new RegExp(word.replace(ESCAPE_PATTERN, '\\$&'), 'i') });
  const rest = [...shape.distinctive.slice(1)].sort((a, b) => b.length - a.length);

  const attempts: Array<{ words: string[]; cap: number }> = [
    { words: [shape.house, ...rest.slice(0, 2)], cap: limit * 10 },
    { words: [shape.house, ...rest.slice(0, 1)], cap: limit * 10 },
    // The fund-house sweep must be generous: SEBI renamings mean the distinctive word in the
    // statement ("Opportunities", "Bluechip") often no longer exists in the current scheme name.
    { words: [shape.house], cap: 600 },
  ];

  const candidates = new Map<string, FundMatch>();

  for (const attempt of attempts) {
    const documents = await FundScheme.find({ $and: attempt.words.map(toCondition) })
      .limit(attempt.cap)
      .lean();

    for (const document of documents) {
      const match = toMatch(document);
      if (!candidates.has(match.schemeCode)) candidates.set(match.schemeCode, match);
    }
  }

  return [...candidates.values()]
    .map((match) => ({ match, value: score(match, shape) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((entry) => entry.match);
}

/**
 * A CAS prints the ISIN next to every scheme, which identifies the exact plan and option — far
 * stronger than matching a statement's abbreviated scheme name against AMFI's full name.
 */
export async function findFundByIsin(isin: string): Promise<FundMatch | null> {
  if (!isDatabaseConnected()) return null;

  const needle = isin.trim().toUpperCase();
  if (!/^INF[A-Z0-9]{9}$/.test(needle)) return null;

  await ensureFundUniverse();

  return cached(`fund-isin:${needle}`, TTL.search, async () => {
    // A statement may quote either of the two ISINs AMFI publishes for a scheme.
    const document = await FundScheme.findOne({ $or: [{ isin: needle }, { isinReinvest: needle }] }).lean();
    return document ? toMatch(document) : null;
  });
}

export async function getFund(schemeCode: string): Promise<FundMatch> {
  if (!isDatabaseConnected()) throw ApiError.badRequest('Mutual fund data needs the database to be connected.');

  await ensureFundUniverse();

  const document = await FundScheme.findOne({ schemeCode }).lean();
  if (!document) throw ApiError.notFound('That scheme is not in the AMFI list.');

  return toMatch(document);
}

export async function getFunds(schemeCodes: string[]): Promise<Map<string, FundMatch>> {
  if (!schemeCodes.length || !isDatabaseConnected()) return new Map();

  await ensureFundUniverse();

  const documents = await FundScheme.find({ schemeCode: { $in: schemeCodes } }).lean();
  return new Map(documents.map((document) => [document.schemeCode, toMatch(document)]));
}

interface MfApiResponse {
  data?: Array<{ date: string; nav: string }>;
}

export async function getNavHistory(schemeCode: string, days: number): Promise<FundNavPoint[]> {
  return cached(`fund-history:${schemeCode}:${days}`, TTL.candlesDaily, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`${HISTORY_URL}/${encodeURIComponent(schemeCode)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw ApiError.upstream(`NAV history responded ${response.status}`);

      const payload = (await response.json()) as MfApiResponse;
      const rows = payload.data ?? [];

      return rows
        .slice(0, days)
        .flatMap((row) => {
          const [day, month, year] = row.date.split('-');
          const nav = Number(row.nav);
          if (!day || !month || !year || !Number.isFinite(nav)) return [];
          return [{ t: new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString(), nav }];
        })
        .reverse();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.upstream('Could not load the NAV history for that scheme.');
    } finally {
      clearTimeout(timer);
    }
  });
}

export async function fundUniverseStatus(): Promise<{ schemes: number; lastRefreshAt: string | null; latestNavDate: string | null }> {
  if (!isDatabaseConnected()) return { schemes: 0, lastRefreshAt: null, latestNavDate: null };

  const [schemes, latest] = await Promise.all([
    FundScheme.estimatedDocumentCount(),
    FundScheme.findOne().sort({ navDate: -1 }).select('navDate').lean(),
  ]);

  return {
    schemes,
    ...fundUniverseAge(),
    latestNavDate: latest?.navDate ? new Date(latest.navDate).toISOString() : null,
  };
}
