import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { xirr, type CashFlow } from '../../utils/xirr.js';
import { currencyForExchange, type AssetType, type Currency, type Exchange } from '../../types/market.js';
import { getFund } from '../funds/fund.service.js';
import { Holding, type HoldingDocument } from './portfolio.model.js';
import { Transaction, type TransactionDocument, type TransactionType } from './transaction.model.js';

export interface TransactionInput {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees?: number;
  date: string;
  notes?: string;
}

export interface PositionState {
  quantity: number;
  avgBuyPrice: number;
  buyDate: Date | null;
  realisedGain: number;
  dividends: number;
  invested: number;
  transactions: number;
}

interface Lot {
  quantity: number;
  price: number;
  date: Date;
}

export function identityKey(entry: {
  assetType: AssetType;
  schemeCode?: string | null;
  exchange?: Exchange | null;
  symbol: string;
}): string {
  return entry.assetType === 'MUTUAL_FUND'
    ? `MF:${entry.schemeCode}`
    : `${entry.exchange}:${entry.symbol.toUpperCase()}`;
}

/**
 * Replays a ledger in date order, matching sales against the oldest lots first.
 * FIFO is what Indian capital gains reporting assumes, so realised gains line up
 * with the broker's own tax statement.
 */
export function replayLedger(transactions: TransactionDocument[]): PositionState {
  const ordered = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  const lots: Lot[] = [];
  let realisedGain = 0;
  let dividends = 0;

  for (const entry of ordered) {
    if (entry.type === 'DIVIDEND') {
      dividends += entry.price * (entry.quantity || 1) - entry.fees;
      continue;
    }

    if (entry.type === 'BUY') {
      lots.push({ quantity: entry.quantity, price: entry.price, date: entry.date });
      realisedGain -= entry.fees;
      continue;
    }

    let remaining = entry.quantity;
    realisedGain -= entry.fees;

    while (remaining > 0 && lots.length) {
      const lot = lots[0];
      const matched = Math.min(lot.quantity, remaining);

      realisedGain += (entry.price - lot.price) * matched;
      lot.quantity -= matched;
      remaining -= matched;

      if (lot.quantity <= 1e-9) lots.shift();
    }

    // Selling more than the ledger holds means the opening position predates it;
    // treat the excess as fully realised at the sale price rather than dropping it.
    if (remaining > 1e-9) realisedGain += entry.price * remaining;
  }

  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const cost = lots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);

  return {
    quantity: Math.round(quantity * 1e6) / 1e6,
    avgBuyPrice: quantity > 0 ? Math.round((cost / quantity) * 1e4) / 1e4 : 0,
    buyDate: lots.length ? lots[0].date : (ordered[0]?.date ?? null),
    realisedGain: Math.round(realisedGain * 100) / 100,
    dividends: Math.round(dividends * 100) / 100,
    invested: Math.round(cost * 100) / 100,
    transactions: ordered.length,
  };
}

export function ledgerCashFlows(transactions: TransactionDocument[]): CashFlow[] {
  return transactions.map((entry) => {
    if (entry.type === 'DIVIDEND') {
      return { date: entry.date, amount: entry.price * (entry.quantity || 1) - entry.fees };
    }

    const gross = entry.quantity * entry.price;
    return {
      date: entry.date,
      amount: entry.type === 'BUY' ? -(gross + entry.fees) : gross - entry.fees,
    };
  });
}

export function positionXirr(transactions: TransactionDocument[], currentValue: number, at = new Date()): number | null {
  const flows = ledgerCashFlows(transactions);
  if (currentValue > 0) flows.push({ date: at, amount: currentValue });

  const rate = xirr(flows);
  return rate === null ? null : Math.round(rate * 100 * 100) / 100;
}

async function resolveIdentity(input: TransactionInput): Promise<{
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  currency: Currency;
}> {
  const assetType = input.assetType ?? 'EQUITY';

  if (assetType === 'MUTUAL_FUND') {
    if (!input.schemeCode) throw ApiError.badRequest('A mutual fund transaction needs its AMFI scheme code.');
    const scheme = await getFund(input.schemeCode);
    return { assetType, symbol: scheme.name, exchange: null, schemeCode: input.schemeCode, currency: 'INR' };
  }

  if (!input.symbol || !input.exchange) {
    throw ApiError.badRequest('A stock transaction needs a symbol and an exchange.');
  }

  return {
    assetType,
    symbol: input.symbol.toUpperCase(),
    exchange: input.exchange,
    schemeCode: null,
    currency: currencyForExchange(input.exchange),
  };
}

export async function transactionsForPosition(
  portfolioId: Types.ObjectId,
  identity: { assetType: AssetType; symbol: string; exchange: Exchange | null; schemeCode: string | null },
): Promise<TransactionDocument[]> {
  const filter =
    identity.assetType === 'MUTUAL_FUND'
      ? { portfolioId, schemeCode: identity.schemeCode }
      : { portfolioId, symbol: identity.symbol, exchange: identity.exchange };

  return Transaction.find(filter).sort({ date: 1 });
}

async function syncHolding(
  userId: Types.ObjectId,
  portfolioId: Types.ObjectId,
  identity: { assetType: AssetType; symbol: string; exchange: Exchange | null; schemeCode: string | null; currency: Currency },
): Promise<HoldingDocument | null> {
  const transactions = await transactionsForPosition(portfolioId, identity);
  const state = replayLedger(transactions);

  const filter =
    identity.assetType === 'MUTUAL_FUND'
      ? { portfolioId, schemeCode: identity.schemeCode }
      : { portfolioId, symbol: identity.symbol, exchange: identity.exchange };

  if (state.quantity <= 0) {
    await Holding.deleteOne(filter);
    return null;
  }

  return Holding.findOneAndUpdate(
    filter,
    {
      $set: {
        userId,
        assetType: identity.assetType,
        symbol: identity.symbol,
        exchange: identity.exchange,
        schemeCode: identity.schemeCode,
        currency: identity.currency,
        quantity: state.quantity,
        avgBuyPrice: state.avgBuyPrice,
        buyDate: state.buyDate ?? new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

export async function addTransaction(
  userId: Types.ObjectId,
  portfolioId: Types.ObjectId,
  input: TransactionInput,
): Promise<{ transaction: TransactionDocument; position: PositionState }> {
  const identity = await resolveIdentity(input);

  const transaction = await Transaction.create({
    ...identity,
    userId,
    portfolioId,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    fees: input.fees ?? 0,
    date: new Date(input.date),
    notes: input.notes,
  });

  await syncHolding(userId, portfolioId, identity);

  return { transaction, position: replayLedger(await transactionsForPosition(portfolioId, identity)) };
}

export async function removeTransaction(
  userId: Types.ObjectId,
  portfolioId: Types.ObjectId,
  transactionId: string,
): Promise<void> {
  const transaction = await Transaction.findOne({ _id: transactionId, portfolioId, userId });
  if (!transaction) throw ApiError.notFound('That transaction does not exist.');

  const identity = {
    assetType: transaction.assetType,
    symbol: transaction.symbol,
    exchange: transaction.exchange,
    schemeCode: transaction.schemeCode,
    currency: transaction.currency,
  };

  await transaction.deleteOne();
  await syncHolding(userId, portfolioId, identity);
}

export async function listTransactions(
  portfolioId: Types.ObjectId,
  limit = 200,
): Promise<TransactionDocument[]> {
  return Transaction.find({ portfolioId }).sort({ date: -1, createdAt: -1 }).limit(limit);
}

export async function ledgerByPosition(portfolioId: Types.ObjectId): Promise<Map<string, TransactionDocument[]>> {
  const transactions = await Transaction.find({ portfolioId }).sort({ date: 1 });
  const grouped = new Map<string, TransactionDocument[]>();

  for (const transaction of transactions) {
    const key = identityKey(transaction);
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  return grouped;
}
