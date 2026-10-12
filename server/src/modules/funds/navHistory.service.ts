import { logger } from '../../config/logger.js';
import { formatDayMonthYear, parseDayMonthYear } from '../../utils/dates.js';

/**
 * AMFI publishes every scheme's NAV for any past date as one file. That is what makes a return
 * column possible across the whole universe: three downloads answer "how has each of 14,000 schemes
 * done over 1, 3 and 5 years", where a per-scheme API would need 42,000 requests.
 */
const HISTORY_URL = 'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx';
const FETCH_TIMEOUT_MS = 90_000;

/** A published NAV is immutable once the day closes, so yesterday's file never needs refetching. */
const cache = new Map<string, Promise<Map<string, number>>>();

/**
 * Funds do not publish on weekends or holidays, so a single date often comes back empty. Asking for
 * a short window and keeping the latest NAV per scheme lands on the nearest trading day instead.
 */
export async function navOn(target: Date, windowDays = 7): Promise<Map<string, number>> {
  const from = new Date(target.getTime() - windowDays * 86_400_000);
  const key = `${formatDayMonthYear(from)}:${formatDayMonthYear(target)}`;

  const existing = cache.get(key);
  if (existing) return existing;

  const pending = (async () => {
    const url = `${HISTORY_URL}?frmdt=${formatDayMonthYear(from)}&todt=${formatDayMonthYear(target)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'text/plain', 'user-agent': 'Plumbline/1.0' },
      });
      if (!response.ok) throw new Error(`AMFI history responded ${response.status}`);
      return parseNavHistory(await response.text());
    } finally {
      clearTimeout(timer);
    }
  })();

  cache.set(key, pending);

  return pending.catch((error: unknown) => {
    // A failed download must not be remembered as "no NAVs", or every later call inherits the gap.
    cache.delete(key);
    logger.warn('AMFI NAV history download failed', { error: error instanceof Error ? error.message : String(error) });
    return new Map<string, number>();
  });
}

/** Keeps the most recent NAV per scheme within the window. */
export function parseNavHistory(content: string): Map<string, number> {
  const navs = new Map<string, number>();
  const seenOn = new Map<string, number>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes(';')) continue;

    const parts = line.split(';');
    if (!/^\d+$/.test(parts[0])) continue;

    // Same column order as NAVAll: code, name, plan, option, isin, isinReinvest, nav, date.
    const nav = Number(parts[6]);
    const date = parseDayMonthYear(parts[7] ?? '');
    if (!Number.isFinite(nav) || nav <= 0 || !date) continue;

    const at = date.getTime();
    if ((seenOn.get(parts[0]) ?? -Infinity) > at) continue;

    seenOn.set(parts[0], at);
    navs.set(parts[0], nav);
  }

  return navs;
}

/** Compound annual growth between two NAVs, as a percentage. Null when either side is missing. */
export function annualisedReturn(from: number | undefined, to: number, years: number): number | null {
  if (!from || from <= 0 || !Number.isFinite(to) || to <= 0) return null;
  const growth = (to / from) ** (1 / years) - 1;
  if (!Number.isFinite(growth)) return null;
  return Math.round(growth * 100 * 100) / 100;
}
