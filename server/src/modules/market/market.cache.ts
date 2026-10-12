interface CacheEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
}

const MAX_ENTRIES = 5_000;
const STALE_MULTIPLIER = 12;

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

let hits = 0;
let misses = 0;

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;
  const overflow = store.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of store.keys()) {
    store.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export const TTL = {
  quote: 20_000,
  search: 5 * 60_000,
  profile: 12 * 60 * 60_000,
  candlesIntraday: 60_000,
  candlesDaily: 30 * 60_000,
} as const;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.freshUntil > now) {
    hits += 1;
    return entry.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  misses += 1;

  const request = loader()
    .then((value) => {
      store.set(key, { value, freshUntil: Date.now() + ttlMs, staleUntil: Date.now() + ttlMs * STALE_MULTIPLIER });
      evictIfNeeded();
      return value;
    })
    .catch((error: unknown) => {
      if (entry && entry.staleUntil > Date.now()) return entry.value;
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function cachePeek<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || entry.freshUntil <= Date.now()) return undefined;
  hits += 1;
  return entry.value;
}

export function cacheSet<T>(key: string, ttlMs: number, value: T): void {
  store.set(key, { value, freshUntil: Date.now() + ttlMs, staleUntil: Date.now() + ttlMs * STALE_MULTIPLIER });
  evictIfNeeded();
}

export function invalidate(prefix: string): number {
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheStats(): { entries: number; hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    entries: store.size,
    hits,
    misses,
    hitRate: total ? Math.round((hits / total) * 100) / 100 : 0,
  };
}
