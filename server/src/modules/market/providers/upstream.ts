import type { ProviderId } from './provider.types.js';

export class UpstreamError extends Error {
  readonly provider: ProviderId;
  readonly status: number;

  constructor(provider: ProviderId, message: string, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.provider = provider;
    this.status = status;
  }
}

interface FetchOptions {
  provider: ProviderId;
  timeoutMs?: number;
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

// Alpha Vantage answers a burst with "please spread out your free API requests more sparingly
// (1 request per second)" — a 200 body that is not data. Spacing calls is the only way to use it.
const MIN_INTERVAL_MS: Partial<Record<ProviderId, number>> = {
  alphavantage: 1_600,
};

const MAX_QUEUED = 8;

const lastCallAt = new Map<ProviderId, number>();
const queues = new Map<ProviderId, Promise<unknown>>();
const queued = new Map<ProviderId, number>();

/**
 * Serialises a provider's calls and holds them at least `gap` apart. Everything else runs
 * untouched, so one slow provider never becomes everyone's bottleneck.
 */
function throttled<T>(provider: ProviderId, task: () => Promise<T>): Promise<T> {
  const gap = MIN_INTERVAL_MS[provider];
  if (!gap) return task();

  const pending = queued.get(provider) ?? 0;
  if (pending >= MAX_QUEUED) {
    return Promise.reject(
      new UpstreamError(provider, `${provider} is rate limited and its queue is full`, 429),
    );
  }

  queued.set(provider, pending + 1);

  const run = (queues.get(provider) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const wait = (lastCallAt.get(provider) ?? 0) + gap - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastCallAt.set(provider, Date.now());
      return task();
    })
    .finally(() => {
      queued.set(provider, Math.max(0, (queued.get(provider) ?? 1) - 1));
    });

  queues.set(provider, run.catch(() => undefined));
  return run;
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  return throttled(options.provider, () => requestJson<T>(url, options));
}

async function requestJson<T>(url: string, options: FetchOptions): Promise<T> {
  const { provider, timeoutMs = 8_000, params, headers } = options;
  const target = new URL(url);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') target.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'Plumbline/1.0', ...headers },
    });

    if (!response.ok) {
      // Keep the provider's own explanation: "not available under your current subscription" is
      // the difference between retrying forever and learning what a plan covers.
      const detail = await response
        .text()
        .then((text) => text.replace(/\s+/g, ' ').slice(0, 200))
        .catch(() => '');

      throw new UpstreamError(
        provider,
        detail ? `${provider} responded ${response.status}: ${detail}` : `${provider} responded ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UpstreamError(provider, `${provider} timed out after ${timeoutMs}ms`, 504);
    }
    throw new UpstreamError(provider, error instanceof Error ? error.message : `${provider} request failed`);
  } finally {
    clearTimeout(timer);
  }
}

export function firstNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed !== 0) return parsed;
  }
  return null;
}

export function toIsoDate(value: string | number | Date): string {
  const date = typeof value === 'number' ? new Date(value * (value > 1e12 ? 1 : 1000)) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
