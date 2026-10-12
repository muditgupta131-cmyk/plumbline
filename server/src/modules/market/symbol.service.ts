import { isDatabaseConnected } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { SEED_SYMBOLS } from '../../data/symbols.seed.js';
import { securityKey, type Market, type SecurityRef } from '../../types/market.js';
import { StockSymbol } from './symbol.model.js';
import type { SymbolMatch } from './providers/provider.types.js';

const ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string): string {
  return value.replace(ESCAPE_PATTERN, '\\$&');
}

export function scoreMatch(match: SymbolMatch, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const symbol = match.symbol.toLowerCase();
  const name = match.name.toLowerCase();

  if (symbol === needle) return 120;
  if (symbol.startsWith(needle)) return 96;
  if (name === needle) return 92;
  if (name.startsWith(needle)) return 80;
  if (name.includes(` ${needle}`)) return 64;
  if (name.includes(needle)) return 48;
  if (symbol.includes(needle)) return 32;
  return 8;
}

export function rankMatches(matches: SymbolMatch[], query: string, limit: number): SymbolMatch[] {
  const byKey = new Map<string, { match: SymbolMatch; score: number }>();

  matches.forEach((match, index) => {
    const key = securityKey(match);
    const score = scoreMatch(match, query) - index * 0.01;
    const existing = byKey.get(key);
    if (!existing || score > existing.score) byKey.set(key, { match, score });
  });

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score || a.match.name.localeCompare(b.match.name))
    .slice(0, limit)
    .map((entry) => entry.match);
}

function toMatch(document: {
  symbol: string;
  exchange: SymbolMatch['exchange'];
  name: string;
  market: Market;
  currency: SymbolMatch['currency'];
  sector?: string;
  industry?: string;
  logoUrl?: string;
}): SymbolMatch {
  return {
    symbol: document.symbol,
    exchange: document.exchange,
    name: document.name,
    market: document.market,
    currency: document.currency,
    ...(document.sector ? { sector: document.sector } : {}),
    ...(document.industry ? { industry: document.industry } : {}),
    ...(document.logoUrl ? { logoUrl: document.logoUrl } : {}),
  };
}

export async function searchLocalSymbols(query: string, limit: number): Promise<SymbolMatch[]> {
  if (!isDatabaseConnected()) return [];

  const pattern = new RegExp(escapeRegex(query.trim()), 'i');

  const documents = await StockSymbol.find({
    $or: [{ symbol: pattern }, { searchName: pattern }],
  })
    .sort({ popular: -1, hitCount: -1 })
    .limit(limit * 4)
    .lean();

  return documents.map(toMatch);
}

function interleaveByMarket(matches: SymbolMatch[], limit: number): SymbolMatch[] {
  const buckets = new Map<Market, SymbolMatch[]>();
  for (const match of matches) {
    const bucket = buckets.get(match.market) ?? [];
    bucket.push(match);
    buckets.set(match.market, bucket);
  }

  const queues = [...buckets.values()];
  const ordered: SymbolMatch[] = [];

  while (ordered.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) ordered.push(next);
      if (ordered.length === limit) break;
    }
  }

  return ordered;
}

export async function popularSymbols(market: Market | undefined, limit: number): Promise<SymbolMatch[]> {
  if (isDatabaseConnected()) {
    const documents = await StockSymbol.find({ popular: true, ...(market ? { market } : {}) })
      .sort({ hitCount: -1, name: 1 })
      .limit(limit * 3)
      .lean();

    if (documents.length) {
      const matches = documents.map(toMatch);
      return market ? matches.slice(0, limit) : interleaveByMarket(matches, limit);
    }
  }

  const seeded = SEED_SYMBOLS.filter((entry) => !market || entry.market === market).map((entry) => toMatch(entry));
  return market ? seeded.slice(0, limit) : interleaveByMarket(seeded, limit);
}

export async function lookupSymbols(refs: SecurityRef[]): Promise<Map<string, SymbolMatch>> {
  const found = new Map<string, SymbolMatch>();

  if (isDatabaseConnected() && refs.length) {
    const documents = await StockSymbol.find({
      $or: refs.map((ref) => ({ exchange: ref.exchange, symbol: ref.symbol.toUpperCase() })),
    }).lean();

    for (const document of documents) found.set(securityKey(document), toMatch(document));
  }

  for (const ref of refs) {
    const key = securityKey(ref);
    if (found.has(key)) continue;

    const seeded = SEED_SYMBOLS.find((entry) => securityKey(entry) === key);
    if (seeded) found.set(key, toMatch(seeded));
  }

  return found;
}

export async function rememberMatches(matches: SymbolMatch[]): Promise<void> {
  if (!isDatabaseConnected() || !matches.length) return;

  try {
    await StockSymbol.bulkWrite(
      matches.map((match) => ({
        updateOne: {
          filter: { exchange: match.exchange, symbol: match.symbol.toUpperCase() },
          update: {
            $set: {
              name: match.name,
              searchName: match.name.toLowerCase(),
              market: match.market,
              currency: match.currency,
              lastSeenAt: new Date(),
              ...(match.sector ? { sector: match.sector } : {}),
              ...(match.industry ? { industry: match.industry } : {}),
              ...(match.logoUrl ? { logoUrl: match.logoUrl } : {}),
            },
            $setOnInsert: { symbol: match.symbol.toUpperCase(), exchange: match.exchange, popular: false },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (error) {
    logger.warn('Could not persist symbol matches', { error: error instanceof Error ? error.message : 'unknown' });
  }
}

export async function recordSymbolHit(ref: SecurityRef): Promise<void> {
  if (!isDatabaseConnected()) return;
  await StockSymbol.updateOne(
    { exchange: ref.exchange, symbol: ref.symbol.toUpperCase() },
    { $inc: { hitCount: 1 }, $set: { lastSeenAt: new Date() } },
  ).catch(() => undefined);
}

export async function seedSymbolUniverse(): Promise<number> {
  if (!isDatabaseConnected()) return 0;

  const result = await StockSymbol.bulkWrite(
    SEED_SYMBOLS.map((entry) => ({
      updateOne: {
        filter: { exchange: entry.exchange, symbol: entry.symbol },
        update: {
          $set: {
            name: entry.name,
            searchName: entry.name.toLowerCase(),
            market: entry.market,
            currency: entry.currency,
            sector: entry.sector,
            industry: entry.industry,
            popular: true,
          },
          $setOnInsert: { symbol: entry.symbol, exchange: entry.exchange, hitCount: 0 },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  return result.upsertedCount + result.modifiedCount;
}
