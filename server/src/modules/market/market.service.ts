import { ApiError } from '../../utils/ApiError.js';
import {
  EXCHANGE_MARKET,
  securityKey,
  type Currency,
  type Exchange,
  type Market,
  type SecurityRef,
} from '../../types/market.js';
import { cachePeek, cacheSet, cacheStats, cached, TTL } from './market.cache.js';
import { exchangeSession, marketSessions, type ExchangeSession } from './marketHours.js';
import {
  hasLiveProvider,
  providerChain,
  providerStatuses,
  sampleFallbackEnabled,
  withFailover,
  type CandleRange,
  type CandleSeries,
  type CompanyProfile,
  type Fundamentals,
  type FxRate,
  type IndexQuote,
  type ProviderId,
  type ProviderResult,
  type Quote,
  type SymbolMatch,
} from './providers/index.js';
import {
  lookupSymbols,
  popularSymbols,
  rankMatches,
  recordSymbolHit,
  rememberMatches,
  searchLocalSymbols,
} from './symbol.service.js';

export type SourceId = ProviderId | 'local' | 'derived';

export type Sourced<T> = T & { source: ProviderId | 'local' };

export interface SearchResponse {
  query: string;
  results: SymbolMatch[];
  source: ProviderId | 'local';
}

export interface QuotesResponse {
  quotes: Array<Sourced<Quote>>;
  failed: string[];
}

export interface UniverseRow {
  symbol: string;
  exchange: Exchange;
  name: string;
  sector: string;
  currency: Quote['currency'];
  price: number;
  change: number;
  changePercent: number;
  volume: number | null;
  marketCap: number | null;
}

export interface MoversResponse {
  market: Market;
  gainers: UniverseRow[];
  losers: UniverseRow[];
  active: UniverseRow[];
  breadth: { advancing: number; declining: number; unchanged: number };
  source: SourceId;
}

export interface SectorPerformance {
  sector: string;
  changePercent: number;
  count: number;
  advancing: number;
  declining: number;
  leader: UniverseRow | null;
  laggard: UniverseRow | null;
}

export interface MarketOverview {
  market: Market;
  sessions: ExchangeSession[];
  indices: Array<Sourced<IndexQuote>>;
  movers: MoversResponse;
  sectors: SectorPerformance[];
  trending: SymbolMatch[];
  asOf: string;
}

export interface MarketStatus {
  sampleFallback: boolean;
  liveData: boolean;
  providers: ReturnType<typeof providerStatuses>;
  cache: ReturnType<typeof cacheStats>;
}

const CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

function candleTtl(range: CandleRange): number {
  return range === '1D' || range === '1W' ? TTL.candlesIntraday : TTL.candlesDaily;
}

export async function searchSymbols(query: string, limit: number): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { query: trimmed, results: [], source: 'local' };

  return cached(`search:${trimmed.toLowerCase()}:${limit}`, TTL.search, async () => {
    const local = await searchLocalSymbols(trimmed, limit);

    if (local.length >= limit) {
      return { query: trimmed, results: rankMatches(local, trimmed, limit), source: 'local' as const };
    }

    try {
      const remote = await withFailover('search', `search "${trimmed}"`, (provider) =>
        provider.search!(trimmed, limit),
      );
      void rememberMatches(remote.data);
      return {
        query: trimmed,
        results: rankMatches([...local, ...remote.data], trimmed, limit),
        source: local.length ? ('local' as const) : remote.source,
      };
    } catch {
      return { query: trimmed, results: rankMatches(local, trimmed, limit), source: 'local' as const };
    }
  });
}

/** An Indian company is listed on both exchanges, so one is a usable stand-in when the other has no data. */
const SIBLING_EXCHANGE: Partial<Record<Exchange, Exchange>> = { NSE: 'BSE', BSE: 'NSE' };

/**
 * Providers index the two Indian exchanges separately and unevenly, which bites hardest on a freshly
 * listed IPO: the National Stock Exchange listing was quotable as `NSE.BO` days before `NSE.NS`
 * existed. Ending at the sample generator there invents a price for a share that is trading and
 * perfectly quotable, so the sibling exchange is asked before settling for that. The same security
 * prices within a fraction of a percent across the two, and the quote is restamped with the exchange
 * the caller asked for so holdings and watchlists still match on their own key.
 */
async function quoteFromEitherExchange(ref: SecurityRef): Promise<ProviderResult<Quote>> {
  const primary = await withFailover('quote', securityKey(ref), (provider) => provider.quote!(ref), {
    market: EXCHANGE_MARKET[ref.exchange],
  });

  const sibling = SIBLING_EXCHANGE[ref.exchange];
  if (primary.source !== 'sample' || !sibling) return primary;

  const alternate: SecurityRef = { ...ref, exchange: sibling };

  try {
    const result = await withFailover('quote', securityKey(alternate), (provider) => provider.quote!(alternate), {
      market: EXCHANGE_MARKET[sibling],
      allowSample: false,
    });
    return { ...result, data: { ...result.data, symbol: ref.symbol, exchange: ref.exchange } };
  } catch {
    return primary;
  }
}

export async function getQuote(ref: SecurityRef): Promise<Sourced<Quote>> {
  void recordSymbolHit(ref);

  return cached(`quote:${securityKey(ref)}`, TTL.quote, async () => {
    const result = await quoteFromEitherExchange(ref);
    return { ...result.data, source: result.source };
  });
}

export async function getQuotes(refs: SecurityRef[]): Promise<QuotesResponse> {
  const unique = [...new Map(refs.map((ref) => [securityKey(ref), ref])).values()];
  const resolved = new Map<string, Sourced<Quote>>();
  const pending: SecurityRef[] = [];

  for (const ref of unique) {
    const hit = cachePeek<Sourced<Quote>>(`quote:${securityKey(ref)}`);
    if (hit) resolved.set(securityKey(ref), hit);
    else pending.push(ref);
  }

  if (pending.length > 1 && providerChain('quotes', { allowSample: false }).length) {
    try {
      const batch = await withFailover(
        'quotes',
        `${pending.length} quotes`,
        (provider) => provider.quotes!(pending),
        { allowSample: false },
      );
      for (const quote of batch.data) {
        const sourced: Sourced<Quote> = { ...quote, source: batch.source };
        const key = securityKey(quote);
        cacheSet(`quote:${key}`, TTL.quote, sourced);
        resolved.set(key, sourced);
      }
    } catch {
      /* fall through to per-symbol resolution */
    }
  }

  const stillMissing = pending.filter((ref) => !resolved.has(securityKey(ref)));

  const settled = await mapWithConcurrency(stillMissing, CONCURRENCY, async (ref) => {
    try {
      return { ok: true as const, quote: await getQuote(ref) };
    } catch {
      return { ok: false as const, key: securityKey(ref) };
    }
  });

  for (const entry of settled) {
    if (entry.ok) resolved.set(securityKey(entry.quote), entry.quote);
  }

  return {
    quotes: unique.flatMap((ref) => {
      const quote = resolved.get(securityKey(ref));
      return quote ? [quote] : [];
    }),
    failed: settled.flatMap((entry) => (entry.ok ? [] : [entry.key])),
  };
}

const UNIVERSE_SIZE = 40;
const UNIVERSE_TTL = 60_000;

async function universeSnapshot(market: Market): Promise<{ rows: UniverseRow[]; source: SourceId }> {
  return cached(`universe:${market}`, UNIVERSE_TTL, async () => {
    const matches = await popularSymbols(market, UNIVERSE_SIZE);
    const byKey = new Map(matches.map((match) => [securityKey(match), match]));
    const { quotes } = await getQuotes(matches.map((match) => ({ symbol: match.symbol, exchange: match.exchange })));

    const rows = quotes.flatMap<UniverseRow>((quote) => {
      const match = byKey.get(securityKey(quote));
      if (!match) return [];
      return [
        {
          symbol: quote.symbol,
          exchange: quote.exchange,
          name: match.name,
          sector: match.sector ?? 'Unclassified',
          currency: quote.currency,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          marketCap: quote.marketCap,
        },
      ];
    });

    return { rows, source: quotes[0]?.source ?? ('derived' as SourceId) };
  });
}

export async function getIndices(market?: Market): Promise<Array<Sourced<IndexQuote>>> {
  return cached(`indices:${market ?? 'all'}`, TTL.quote, async () => {
    const result = await withFailover('indices', `indices ${market ?? 'all'}`, (provider) => provider.indices!(market));
    return result.data.map((index) => ({ ...index, source: result.source }));
  });
}

export async function getMovers(market: Market, limit: number): Promise<MoversResponse> {
  const { rows, source } = await universeSnapshot(market);

  const byChange = [...rows].sort((a, b) => b.changePercent - a.changePercent);
  const byVolume = [...rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  return {
    market,
    gainers: byChange.filter((row) => row.changePercent > 0).slice(0, limit),
    losers: byChange.filter((row) => row.changePercent < 0).reverse().slice(0, limit),
    active: byVolume.slice(0, limit),
    breadth: {
      advancing: rows.filter((row) => row.changePercent > 0).length,
      declining: rows.filter((row) => row.changePercent < 0).length,
      unchanged: rows.filter((row) => row.changePercent === 0).length,
    },
    source,
  };
}

export async function getSectors(market: Market): Promise<SectorPerformance[]> {
  const { rows } = await universeSnapshot(market);
  const grouped = new Map<string, UniverseRow[]>();

  for (const row of rows) {
    const bucket = grouped.get(row.sector) ?? [];
    bucket.push(row);
    grouped.set(row.sector, bucket);
  }

  return [...grouped.entries()]
    .map(([sector, members]) => {
      const sorted = [...members].sort((a, b) => b.changePercent - a.changePercent);
      const total = members.reduce((sum, row) => sum + row.changePercent, 0);

      return {
        sector,
        changePercent: Math.round((total / members.length) * 100) / 100,
        count: members.length,
        advancing: members.filter((row) => row.changePercent > 0).length,
        declining: members.filter((row) => row.changePercent < 0).length,
        leader: sorted[0] ?? null,
        laggard: sorted[sorted.length - 1] ?? null,
      };
    })
    .sort((a, b) => b.changePercent - a.changePercent);
}

export function getSessions(market?: Market): ExchangeSession[] {
  return marketSessions(market);
}

export async function getOverview(market: Market, moversLimit: number): Promise<MarketOverview> {
  const [indices, movers, sectors, trending] = await Promise.all([
    getIndices(market),
    getMovers(market, moversLimit),
    getSectors(market),
    getTrending(market, 8),
  ]);

  return {
    market,
    sessions: marketSessions(market),
    indices,
    movers,
    sectors,
    trending,
    asOf: new Date().toISOString(),
  };
}

export async function getProfile(ref: SecurityRef): Promise<Sourced<CompanyProfile>> {
  void recordSymbolHit(ref);

  return cached(`profile:${securityKey(ref)}`, TTL.profile, async () => {
    const result = await withFailover('profile', securityKey(ref), (provider) => provider.profile!(ref), {
      market: EXCHANGE_MARKET[ref.exchange],
    });
    return { ...result.data, source: result.source };
  });
}

export async function getFundamentals(ref: SecurityRef): Promise<Sourced<Fundamentals>> {
  return cached(`fundamentals:${securityKey(ref)}`, TTL.profile, async () => {
    // Tickers drift between exchanges and over time, so hand providers the company name too.
    const known = await lookupSymbols([ref]);
    const companyName = known.get(securityKey(ref))?.name;

    const result = await withFailover(
      'fundamentals',
      securityKey(ref),
      (provider) => provider.fundamentals!(ref, companyName),
      { market: EXCHANGE_MARKET[ref.exchange] },
    );
    return { ...result.data, source: result.source };
  });
}

export interface StockDetail {
  quote: Sourced<Quote>;
  profile: Sourced<CompanyProfile> | null;
  fundamentals: Sourced<Fundamentals> | null;
  candles: Sourced<CandleSeries> | null;
  session: ExchangeSession;
}

export async function getStockDetail(ref: SecurityRef, range: CandleRange): Promise<StockDetail> {
  const [quote, profile, fundamentals, candles] = await Promise.all([
    getQuote(ref),
    getProfile(ref).catch(() => null),
    getFundamentals(ref).catch(() => null),
    getCandles(ref, range).catch(() => null),
  ]);

  return { quote, profile, fundamentals, candles, session: exchangeSession(ref.exchange) };
}

export async function getCandles(ref: SecurityRef, range: CandleRange): Promise<Sourced<CandleSeries>> {
  return cached(`candles:${securityKey(ref)}:${range}`, candleTtl(range), async () => {
    const result = await withFailover(
      'candles',
      `${securityKey(ref)} ${range}`,
      (provider) => provider.candles!(ref, range),
      { market: EXCHANGE_MARKET[ref.exchange] },
    );

    if (!result.data.candles.length) throw ApiError.notFound('No price history is available for this symbol.');

    return { ...result.data, source: result.source };
  });
}

const FX_TTL = 60 * 60_000;

export async function getFxRate(base: Currency, quote: Currency): Promise<Sourced<FxRate>> {
  if (base === quote) {
    return { base, quote, rate: 1, asOf: new Date().toISOString(), source: 'local' };
  }

  return cached(`fx:${base}:${quote}`, FX_TTL, async () => {
    const result = await withFailover('fx', `${base}/${quote}`, (provider) => provider.fxRate!(base, quote));
    return { ...result.data, source: result.source };
  });
}

export async function convert(amount: number, from: Currency, to: Currency): Promise<number> {
  if (from === to) return amount;
  const { rate } = await getFxRate(from, to);
  return amount * rate;
}

export async function getTrending(market: Market | undefined, limit: number): Promise<SymbolMatch[]> {
  return popularSymbols(market, limit);
}

export interface ComparisonEntry {
  symbol: string;
  exchange: Exchange;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: Quote['currency'];
  quote: Sourced<Quote>;
  fundamentals: Sourced<Fundamentals> | null;
  logoUrl: string | null;
}

export interface ComparisonResponse {
  entries: ComparisonEntry[];
  failed: string[];
}

const COMPARE_LIMIT = 4;

export async function compareSecurities(refs: SecurityRef[]): Promise<ComparisonResponse> {
  if (refs.length > COMPARE_LIMIT) {
    throw ApiError.badRequest(`Compare up to ${COMPARE_LIMIT} companies at a time.`);
  }

  const settled = await Promise.all(
    refs.map(async (ref) => {
      try {
        const [quote, profile, fundamentals] = await Promise.all([
          getQuote(ref),
          getProfile(ref).catch(() => null),
          getFundamentals(ref).catch(() => null),
        ]);

        return {
          ok: true as const,
          entry: {
            symbol: quote.symbol,
            exchange: quote.exchange,
            name: profile?.name ?? quote.symbol,
            sector: profile?.sector ?? null,
            industry: profile?.industry ?? null,
            currency: quote.currency,
            quote,
            fundamentals,
            logoUrl: profile?.logoUrl ?? null,
          } satisfies ComparisonEntry,
        };
      } catch {
        return { ok: false as const, key: securityKey(ref) };
      }
    }),
  );

  return {
    entries: settled.flatMap((row) => (row.ok ? [row.entry] : [])),
    failed: settled.flatMap((row) => (row.ok ? [] : [row.key])),
  };
}

export function getMarketStatus(): MarketStatus {
  return {
    sampleFallback: sampleFallbackEnabled(),
    liveData: hasLiveProvider('quote'),
    providers: providerStatuses(),
    cache: cacheStats(),
  };
}
