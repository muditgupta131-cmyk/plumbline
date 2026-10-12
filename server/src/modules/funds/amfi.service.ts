import { isDatabaseConnected } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { FundScheme } from './fund.model.js';
import { parseDayMonthYear } from '../../utils/dates.js';

const NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const REFRESH_INTERVAL_MS = 6 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 45_000;

export interface ParsedScheme {
  schemeCode: string;
  name: string;
  plan: string | null;
  option: string | null;
  fundHouse: string;
  category: string;
  isin: string | null;
  isinReinvest: string | null;
  nav: number;
  navDate: Date;
}

/**
 * AMFI writes the same category both ways — "Equity Scheme - Mid Cap Fund" and "Equity Schemes - Mid
 * Cap Fund" — which splits fourteen of the largest categories in two. Filtering on either then shows
 * half the funds, so the two spellings are folded together here, at the one place they enter.
 */
export function normaliseCategory(value: string): string {
  return value
    .replace(/\bSchemes\b/gi, 'Scheme')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNavFile(content: string): ParsedScheme[] {
  const schemes: ParsedScheme[] = [];
  let category = 'Uncategorised';
  let fundHouse = 'Unknown';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!line.includes(';')) {
      if (/schemes?\s*\(/i.test(line)) {
        const inner = /\(([^)]+)\)/.exec(line);
        category = normaliseCategory(inner ? inner[1].trim() : line);
      } else if (!/^scheme code/i.test(line)) {
        fundHouse = line;
      }
      continue;
    }

    const parts = line.split(';').map((part) => part.trim());
    if (!/^\d+$/.test(parts[0])) continue;

    const hasPlanColumns = parts.length >= 8;
    const name = parts[3];
    const plan = hasPlanColumns ? parts[4] || null : null;
    const option = hasPlanColumns ? parts[5] || null : null;
    const nav = Number(hasPlanColumns ? parts[6] : parts[4]);
    const navDate = parseDayMonthYear(hasPlanColumns ? parts[7] : parts[5]);

    if (!name || !Number.isFinite(nav) || nav <= 0 || !navDate) continue;

    // AMFI prints two ISINs per row: growth/payout first, reinvestment second. A statement can
    // quote either, so both are kept and both are matchable.
    const clean = (value: string | undefined) => (value && value !== '-' && value !== 'N.A.' ? value : null);
    const isin = clean(parts[1]) ?? clean(parts[2]);
    const isinReinvest = clean(parts[1]) ? clean(parts[2]) : null;
    const fullName = [name, plan, option].filter(Boolean).join(' ').replace(/\s+/g, ' ');

    schemes.push({ schemeCode: parts[0], name: fullName, plan, option, fundHouse, category, isin, isinReinvest, nav, navDate });
  }

  return schemes;
}

async function download(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(NAV_URL, {
      signal: controller.signal,
      headers: { accept: 'text/plain', 'user-agent': 'Plumbline/1.0' },
    });
    if (!response.ok) throw new Error(`AMFI responded ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

let lastRefreshAt = 0;
let refreshing: Promise<number> | null = null;

export async function refreshFundUniverse(force = false): Promise<number> {
  if (!isDatabaseConnected()) return 0;
  if (!force && Date.now() - lastRefreshAt < REFRESH_INTERVAL_MS) return 0;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const schemes = parseNavFile(await download());
    if (!schemes.length) throw new Error('AMFI returned no schemes');

    for (let index = 0; index < schemes.length; index += 1000) {
      const batch = schemes.slice(index, index + 1000);
      await FundScheme.bulkWrite(
        batch.map((scheme) => ({
          updateOne: {
            filter: { schemeCode: scheme.schemeCode },
            update: { $set: { ...scheme, searchName: scheme.name.toLowerCase() } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    lastRefreshAt = Date.now();
    return schemes.length;
  })()
    .catch((error: Error) => {
      logger.warn('AMFI NAV refresh failed', { error: error.message });
      return 0;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export function fundUniverseAge(): { lastRefreshAt: string | null } {
  return { lastRefreshAt: lastRefreshAt ? new Date(lastRefreshAt).toISOString() : null };
}
