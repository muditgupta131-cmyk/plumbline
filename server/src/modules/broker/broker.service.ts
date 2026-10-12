import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../config/logger.js';
import { reconcileBrokerHoldings, type ReconcileResult } from '../portfolio/portfolio.service.js';
import { searchSymbols } from '../market/market.service.js';
import { rememberMatches } from '../market/symbol.service.js';
import { currencyForExchange, EXCHANGE_MARKET } from '../../types/market.js';
import type { SymbolMatch } from '../market/providers/index.js';
import { adapterFor, BROKER_ADAPTERS, type BrokerHolding, type BrokerId } from './adapters/index.js';
import { BrokerConnection } from './broker.model.js';
import { decryptSecret, encryptionAvailable, encryptSecret, maskSecret } from './crypto.js';

export interface BrokerCatalogueEntry {
  id: BrokerId;
  label: string;
  docsUrl: string;
  setupSteps: string[];
  credentialFields: Array<{ key: string; label: string; help: string; secret: boolean }>;
}

export interface ConnectionSummary {
  id: string;
  broker: BrokerId;
  brokerLabel: string;
  label: string;
  hint: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  holdingsSynced: number;
}

export function brokerCatalogue(): { available: boolean; note: string; brokers: BrokerCatalogueEntry[] } {
  return {
    available: encryptionAvailable(),
    note: encryptionAvailable()
      ? 'Plumbline stores broker credentials encrypted with AES-256-GCM and only ever calls read-only holdings endpoints.'
      : 'Set ENCRYPTION_KEY in server/.env to enable broker connections. Until then, use the CSV import.',
    brokers: Object.values(BROKER_ADAPTERS).map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      docsUrl: adapter.docsUrl,
      setupSteps: adapter.setupSteps,
      credentialFields: adapter.credentialFields,
    })),
  };
}

function toSummary(document: {
  _id: Types.ObjectId;
  broker: BrokerId;
  label: string;
  hint: string;
  lastSyncedAt?: Date;
  lastError?: string;
  holdingsSynced: number;
}): ConnectionSummary {
  return {
    id: document._id.toString(),
    broker: document.broker,
    brokerLabel: BROKER_ADAPTERS[document.broker].label,
    label: document.label,
    hint: document.hint,
    lastSyncedAt: document.lastSyncedAt?.toISOString() ?? null,
    lastError: document.lastError ?? null,
    holdingsSynced: document.holdingsSynced,
  };
}

export async function listConnections(userId: Types.ObjectId): Promise<ConnectionSummary[]> {
  const connections = await BrokerConnection.find({ userId }).sort({ createdAt: 1 });
  return connections.map(toSummary);
}

export async function connectBroker(
  userId: Types.ObjectId,
  broker: BrokerId,
  credentials: Record<string, string>,
): Promise<{ connection: ConnectionSummary; holdings: number }> {
  if (!encryptionAvailable()) {
    throw ApiError.badRequest('Broker connections are disabled: ENCRYPTION_KEY is not set on this server.');
  }

  const adapter = adapterFor(broker);

  for (const field of adapter.credentialFields) {
    if (!credentials[field.key]?.trim()) throw ApiError.badRequest(`${field.label} is required.`);
  }

  const holdings = await adapter.fetchHoldings(credentials);

  const secretField = adapter.credentialFields.find((field) => field.secret) ?? adapter.credentialFields[0];
  const connection = await BrokerConnection.findOneAndUpdate(
    { userId, broker },
    {
      $set: {
        label: adapter.label,
        credentials: encryptSecret(JSON.stringify(credentials)),
        hint: maskSecret(credentials[secretField.key] ?? ''),
        lastError: null,
      },
    },
    { upsert: true, new: true },
  );

  return { connection: toSummary(connection), holdings: holdings.length };
}

export async function disconnectBroker(userId: Types.ObjectId, connectionId: string): Promise<void> {
  const result = await BrokerConnection.deleteOne({ _id: connectionId, userId });
  if (!result.deletedCount) throw ApiError.notFound('That broker connection does not exist.');
}

export interface ResolvedBrokerHolding {
  symbol: string;
  exchange: BrokerHolding['exchange'];
  quantity: number;
  avgBuyPrice: number;
  recognised: boolean;
}

/**
 * A holding the broker reports is real whether or not Plumbline has heard of it. Anything the
 * symbol universe cannot match is imported under the broker's own symbol and registered, rather
 * than being dropped — otherwise a newly listed stock or an ETF vanishes with no explanation.
 */
export async function resolveBrokerHoldings(
  holdings: BrokerHolding[],
): Promise<{ rows: ResolvedBrokerHolding[]; skipped: Array<{ symbol: string; reason: string }> }> {
  const rows: ResolvedBrokerHolding[] = [];
  const skipped: Array<{ symbol: string; reason: string }> = [];
  const discovered: SymbolMatch[] = [];

  for (const holding of holdings) {
    if (!holding.symbol) {
      skipped.push({ symbol: '(unnamed)', reason: 'The broker returned a holding with no trading symbol.' });
      continue;
    }

    if (!(holding.quantity > 0)) {
      skipped.push({ symbol: holding.symbol, reason: 'Quantity is zero.' });
      continue;
    }

    const { results } = await searchSymbols(holding.symbol, 4);
    const match =
      results.find((item) => item.symbol.toUpperCase() === holding.symbol && item.exchange === holding.exchange) ??
      results.find((item) => item.symbol.toUpperCase() === holding.symbol) ??
      null;

    if (match) {
      rows.push({
        symbol: match.symbol,
        exchange: match.exchange,
        quantity: holding.quantity,
        avgBuyPrice: holding.avgBuyPrice,
        recognised: true,
      });
      continue;
    }

    const exchange = holding.exchange;
    const market = EXCHANGE_MARKET[exchange];

    discovered.push({
      symbol: holding.symbol,
      exchange,
      name: holding.name?.trim() || holding.symbol,
      market,
      currency: currencyForExchange(exchange),
    });

    rows.push({
      symbol: holding.symbol,
      exchange,
      quantity: holding.quantity,
      avgBuyPrice: holding.avgBuyPrice,
      recognised: false,
    });
  }

  if (discovered.length) await rememberMatches(discovered);

  return { rows, skipped };
}

export interface SyncResult extends ReconcileResult {
  fetched: number;
  matched: number;
  discovered: string[];
  skipped: Array<{ symbol: string; reason: string }>;
  syncedAt: string;
}

export async function syncBroker(
  userId: Types.ObjectId,
  connectionId: string,
  portfolioId: string,
): Promise<SyncResult> {
  const connection = await BrokerConnection.findOne({ _id: connectionId, userId }).select('+credentials');
  if (!connection) throw ApiError.notFound('That broker connection does not exist.');

  const adapter = adapterFor(connection.broker);
  const credentials = JSON.parse(decryptSecret(connection.credentials)) as Record<string, string>;

  try {
    const holdings = await adapter.fetchHoldings(credentials);

    if (!holdings.length) {
      throw ApiError.badRequest(
        `${adapter.label} returned no holdings for this account. If you hold positions there, check the API key has holdings access.`,
      );
    }

    const { rows, skipped } = await resolveBrokerHoldings(holdings);

    if (!rows.length) {
      throw ApiError.badRequest(
        `${adapter.label} returned ${holdings.length} holding${holdings.length === 1 ? '' : 's'}, but none could be imported: ` +
          skipped.map((entry) => `${entry.symbol} — ${entry.reason}`).join('; '),
      );
    }

    const result = await reconcileBrokerHoldings(userId, portfolioId, connection.broker, rows);

    connection.lastSyncedAt = new Date();
    connection.lastError = undefined;
    connection.holdingsSynced = rows.length;
    await connection.save();

    return {
      ...result,
      skipped: [...skipped, ...result.skipped],
      fetched: holdings.length,
      matched: rows.length,
      discovered: rows.filter((row) => !row.recognised).map((row) => `${row.exchange}:${row.symbol}`),
      syncedAt: connection.lastSyncedAt.toISOString(),
    };
  } catch (error) {
    connection.lastError = error instanceof Error ? error.message : 'Sync failed.';
    await connection.save();
    logger.warn('Broker sync failed', { broker: connection.broker, error: connection.lastError });
    throw error;
  }
}
