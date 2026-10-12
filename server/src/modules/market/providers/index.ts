import { logger } from '../../../config/logger.js';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';
import { alphaVantageProvider } from './alphaVantage.provider.js';
import { finnhubProvider } from './finnhub.provider.js';
import { fmpProvider } from './fmp.provider.js';
import { sampleProvider } from './sample.provider.js';
import { twelveDataProvider } from './twelveData.provider.js';
import { yahooProvider } from './yahoo.provider.js';
import { bseProvider } from './bse.provider.js';
import type { Capability, MarketProvider, ProviderId } from './provider.types.js';
import { UpstreamError } from './upstream.js';
import type { Market } from '../../../types/market.js';

export const PROVIDER_PRIORITY: MarketProvider[] = [
  fmpProvider,
  finnhubProvider,
  twelveDataProvider,
  // Keyless and unmetered, so it goes ahead of the tightly rationed Alpha Vantage tier.
  yahooProvider,
  // Keyless BSE endpoints are the only free source of Indian fundamentals.
  bseProvider,
  alphaVantageProvider,
];

// Alpha Vantage's free tier allows 25 requests a day; spending it like the others would exhaust
// it in a single page view and turn every later call into a throttle notice.
const PROVIDER_DAILY_LIMITS: Partial<Record<ProviderId, number>> = {
  alphavantage: 20,
};

function dailyLimit(id: ProviderId): number {
  return PROVIDER_DAILY_LIMITS[id] ?? env.MARKET_DAILY_CALL_BUDGET;
}

interface ProviderUsage {
  calls: number;
  failures: number;
  coverageMisses: number;
  lastLatencyMs: number | null;
  lastUsedAt: string | null;
  lastError: string | null;
  spentToday: number;
  budgetDay: string;
}

const usage = new Map<ProviderId, ProviderUsage>();

function usageFor(id: ProviderId): ProviderUsage {
  let entry = usage.get(id);
  if (!entry) {
    entry = {
      calls: 0,
      failures: 0,
      coverageMisses: 0,
      lastLatencyMs: null,
      lastUsedAt: null,
      lastError: null,
      spentToday: 0,
      budgetDay: today(),
    };
    usage.set(id, entry);
  }
  return entry;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function spend(id: ProviderId): void {
  const stat = usageFor(id);
  const day = today();

  if (stat.budgetDay !== day) {
    stat.budgetDay = day;
    stat.spentToday = 0;
  }

  stat.spentToday += 1;
}

export function budgetRemaining(id: ProviderId): number {
  const stat = usageFor(id);
  if (stat.budgetDay !== today()) return dailyLimit(id);
  return Math.max(0, dailyLimit(id) - stat.spentToday);
}

// A provider that answers "not on your plan" for a market will keep saying so. Remember it for
// the day rather than spending a metered call on every symbol to be told the same thing.
const uncovered = new Map<string, number>();
const UNCOVERED_TTL_MS = 24 * 60 * 60 * 1000;

const PLAN_LIMIT_PATTERN = /plan|subscription|upgrad|premium|restricted/i;

function coverageKey(id: ProviderId, market: Market): string {
  return `${id}:${market}`;
}

export function markUncovered(id: ProviderId, market: Market, reason: string): void {
  uncovered.set(coverageKey(id, market), Date.now() + UNCOVERED_TTL_MS);
  logger.info('Provider does not cover this market on the current plan', { provider: id, market, reason });
}

export function isUncovered(id: ProviderId, market: Market): boolean {
  const until = uncovered.get(coverageKey(id, market));
  if (!until) return false;
  if (until > Date.now()) return true;

  uncovered.delete(coverageKey(id, market));
  return false;
}

export function coverageGaps(): Array<{ provider: ProviderId; market: Market }> {
  const now = Date.now();
  return [...uncovered.entries()]
    .filter(([, until]) => until > now)
    .map(([key]) => {
      const [provider, market] = key.split(':');
      return { provider: provider as ProviderId, market: market as Market };
    });
}

export function sampleFallbackEnabled(): boolean {
  return env.MARKET_SAMPLE_FALLBACK;
}

export interface ChainOptions {
  market?: Market;
  /**
   * Batch calls must not be allowed to end on sample data: one provider that cannot serve a
   * market would otherwise stamp simulated prices onto every symbol in the request and cache
   * them, hiding providers that could have answered symbol by symbol.
   */
  allowSample?: boolean;
}

export function providerChain(capability: Capability, options: ChainOptions = {}): MarketProvider[] {
  const { market, allowSample = true } = options;

  const live = PROVIDER_PRIORITY.filter(
    (provider) =>
      provider.isConfigured() &&
      provider.capabilities.includes(capability) &&
      budgetRemaining(provider.id) > 0 &&
      !(market && isUncovered(provider.id, market)),
  );

  return allowSample && sampleFallbackEnabled() ? [...live, sampleProvider] : live;
}

export function hasLiveProvider(capability: Capability): boolean {
  return PROVIDER_PRIORITY.some((provider) => provider.isConfigured() && provider.capabilities.includes(capability));
}

export interface ProviderResult<T> {
  data: T;
  source: ProviderId;
}

export async function withFailover<T>(
  capability: Capability,
  label: string,
  task: (provider: MarketProvider) => Promise<T>,
  options: ChainOptions = {},
): Promise<ProviderResult<T>> {
  const { market } = options;
  const chain = providerChain(capability, options);

  if (!chain.length) {
    throw ApiError.upstream('No market data provider is configured for this request.');
  }

  let lastError: unknown;

  for (const provider of chain) {
    const stat = usageFor(provider.id);
    const startedAt = Date.now();
    stat.calls += 1;
    stat.lastUsedAt = new Date().toISOString();
    if (provider.id !== 'sample') spend(provider.id);

    try {
      const data = await task(provider);
      stat.lastLatencyMs = Date.now() - startedAt;
      return { data, source: provider.id };
    } catch (error) {
      lastError = error;
      stat.lastLatencyMs = Date.now() - startedAt;
      stat.lastError = error instanceof Error ? error.message : 'Unknown provider error';

      const status = error instanceof UpstreamError ? error.status : 0;
      const planLimited = status === 402 || (status === 404 && PLAN_LIMIT_PATTERN.test(stat.lastError));

      // A provider that does not cover this market is the chain working as designed, not a
      // fault. Counting both as "failures" made a healthy setup look broken on the status page.
      const coverageMiss = planLimited || status === 402 || status === 403 || status === 404;
      if (coverageMiss) stat.coverageMisses += 1;
      else stat.failures += 1;

      if (market && planLimited && provider.id !== 'sample') {
        markUncovered(provider.id, market, stat.lastError);
      }

      logger.warn('Market provider failed, falling through', {
        provider: provider.id,
        capability,
        label,
        error: stat.lastError,
      });
    }
  }

  throw ApiError.upstream(
    lastError instanceof Error
      ? `Every market data provider failed for ${label}: ${lastError.message}`
      : `Every market data provider failed for ${label}.`,
  );
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  capabilities: readonly Capability[];
  calls: number;
  failures: number;
  coverageMisses: number;
  lastLatencyMs: number | null;
  lastUsedAt: string | null;
  lastError: string | null;
  spentToday: number;
  budgetDay: string;
  budgetRemaining: number | null;
}

export function providerStatuses(): ProviderStatus[] {
  return [...PROVIDER_PRIORITY, sampleProvider].map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.id === 'sample' ? sampleFallbackEnabled() : provider.isConfigured(),
    capabilities: provider.capabilities,
    ...usageFor(provider.id),
    // null means unmetered, which survives JSON where Infinity does not.
    budgetRemaining: provider.id === 'sample' ? null : budgetRemaining(provider.id),
  }));
}

export { sampleProvider };
export * from './provider.types.js';
