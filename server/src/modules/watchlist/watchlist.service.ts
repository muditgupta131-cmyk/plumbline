import type { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { securityKey, type AssetType, type Currency, type Exchange, type SecurityRef } from '../../types/market.js';
import { getQuotes } from '../market/market.service.js';
import { getFund, getFunds } from '../funds/fund.service.js';
import { lookupSymbols } from '../market/symbol.service.js';
import { Alert, WatchlistItem, type AlertType, type WatchlistItemDocument } from './watchlist.model.js';

export interface WatchlistInput {
  assetType?: AssetType;
  symbol?: string;
  exchange?: Exchange;
  schemeCode?: string;
  notes?: string;
}

export interface WatchedItem {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: Exchange | null;
  schemeCode: string | null;
  name: string;
  sector: string | null;
  currency: Currency;
  price: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  navDate: string | null;
  priced: boolean;
  alerts: number;
  notes?: string;
  addedAt: string;
}

function itemKey(item: { assetType: AssetType; schemeCode: string | null; exchange: Exchange | null; symbol: string }): string {
  return item.assetType === 'MUTUAL_FUND' ? `MF:${item.schemeCode}` : `${item.exchange}:${item.symbol.toUpperCase()}`;
}

export async function listWatchlist(userId: Types.ObjectId): Promise<WatchedItem[]> {
  const items = await WatchlistItem.find({ userId }).sort({ createdAt: -1 });
  if (!items.length) return [];

  const equities = items.filter((item) => item.assetType === 'EQUITY' && item.exchange);
  const funds = items.filter((item) => item.assetType === 'MUTUAL_FUND' && item.schemeCode);

  const refs: SecurityRef[] = equities.map((item) => ({ symbol: item.symbol, exchange: item.exchange! }));

  const [{ quotes }, metadata, schemes, alerts] = await Promise.all([
    refs.length ? getQuotes(refs) : Promise.resolve({ quotes: [], failed: [] }),
    lookupSymbols(refs),
    funds.length ? getFunds(funds.map((item) => item.schemeCode!)) : Promise.resolve(new Map()),
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { userId, active: true } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$assetType', 'MUTUAL_FUND'] },
              { $concat: ['MF:', '$schemeCode'] },
              { $concat: ['$exchange', ':', '$symbol'] },
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const quoteMap = new Map(quotes.map((quote) => [securityKey(quote), quote]));
  const alertMap = new Map(alerts.map((row) => [row._id, row.count]));

  return items.map((item) => {
    const key = itemKey(item);
    const isFund = item.assetType === 'MUTUAL_FUND';
    const scheme = isFund ? schemes.get(item.schemeCode!) : undefined;
    const quote = isFund ? undefined : quoteMap.get(key);
    const meta = isFund ? undefined : metadata.get(key);

    return {
      id: item._id.toString(),
      assetType: item.assetType,
      symbol: item.symbol,
      exchange: item.exchange,
      schemeCode: item.schemeCode,
      name: isFund ? (scheme?.name ?? item.name) : (meta?.name ?? item.name),
      sector: isFund ? (scheme?.category ?? null) : (meta?.sector ?? null),
      currency: isFund ? 'INR' : (quote?.currency ?? 'INR'),
      price: isFund ? (scheme?.nav ?? null) : (quote?.price ?? null),
      changePercent: quote?.changePercent ?? null,
      dayHigh: quote?.high ?? null,
      dayLow: quote?.low ?? null,
      week52High: quote?.week52High ?? null,
      week52Low: quote?.week52Low ?? null,
      navDate: scheme?.navDate ?? null,
      priced: isFund ? Boolean(scheme) : Boolean(quote),
      alerts: alertMap.get(key) ?? 0,
      ...(item.notes ? { notes: item.notes } : {}),
      addedAt: item.createdAt.toISOString(),
    };
  });
}

export async function addToWatchlist(userId: Types.ObjectId, input: WatchlistInput): Promise<WatchlistItemDocument> {
  const assetType = input.assetType ?? 'EQUITY';

  const count = await WatchlistItem.countDocuments({ userId });
  if (count >= 100) throw ApiError.badRequest('A watchlist can hold up to 100 names.');

  if (assetType === 'MUTUAL_FUND') {
    if (!input.schemeCode) throw ApiError.badRequest('A fund needs its AMFI scheme code.');
    const scheme = await getFund(input.schemeCode);

    const existing = await WatchlistItem.findOne({ userId, schemeCode: input.schemeCode });
    if (existing) throw ApiError.conflict('That scheme is already on your watchlist.');

    return WatchlistItem.create({
      userId,
      assetType,
      symbol: scheme.name,
      exchange: null,
      schemeCode: input.schemeCode,
      name: scheme.name,
      notes: input.notes,
    });
  }

  if (!input.symbol || !input.exchange) throw ApiError.badRequest('A stock needs a symbol and an exchange.');

  const symbol = input.symbol.toUpperCase();
  const existing = await WatchlistItem.findOne({ userId, symbol, exchange: input.exchange });
  if (existing) throw ApiError.conflict('That listing is already on your watchlist.');

  const known = await lookupSymbols([{ symbol, exchange: input.exchange }]);
  const match = known.get(`${input.exchange}:${symbol}`);

  return WatchlistItem.create({
    userId,
    assetType,
    symbol,
    exchange: input.exchange,
    schemeCode: null,
    name: match?.name ?? symbol,
    notes: input.notes,
  });
}

export async function removeFromWatchlist(userId: Types.ObjectId, itemId: string): Promise<void> {
  const item = await WatchlistItem.findOne({ _id: itemId, userId });
  if (!item) throw ApiError.notFound('That watchlist entry does not exist.');

  await Alert.deleteMany(
    item.assetType === 'MUTUAL_FUND'
      ? { userId, schemeCode: item.schemeCode }
      : { userId, symbol: item.symbol, exchange: item.exchange },
  );

  await item.deleteOne();
}

export interface AlertInput {
  itemId: string;
  type: AlertType;
  threshold: number;
  note?: string;
}

export async function createAlert(userId: Types.ObjectId, input: AlertInput) {
  const item = await WatchlistItem.findOne({ _id: input.itemId, userId });
  if (!item) throw ApiError.notFound('That watchlist entry does not exist.');

  const count = await Alert.countDocuments({ userId, active: true });
  if (count >= 100) throw ApiError.badRequest('You can keep up to 100 active alerts.');

  if (input.type === 'PERCENT_MOVE' && input.threshold <= 0) {
    throw ApiError.badRequest('A percentage move alert needs a positive threshold.');
  }
  if (input.type !== 'PERCENT_MOVE' && input.threshold <= 0) {
    throw ApiError.badRequest('A price alert needs a price above zero.');
  }

  return Alert.create({
    userId,
    assetType: item.assetType,
    symbol: item.symbol,
    exchange: item.exchange,
    schemeCode: item.schemeCode,
    name: item.name,
    type: input.type,
    threshold: input.threshold,
    note: input.note,
  });
}

export async function listAlerts(userId: Types.ObjectId) {
  return Alert.find({ userId }).sort({ active: -1, createdAt: -1 });
}

export async function removeAlert(userId: Types.ObjectId, alertId: string): Promise<void> {
  const result = await Alert.deleteOne({ _id: alertId, userId });
  if (!result.deletedCount) throw ApiError.notFound('That alert does not exist.');
}

export async function setAlertActive(userId: Types.ObjectId, alertId: string, active: boolean) {
  const alert = await Alert.findOneAndUpdate({ _id: alertId, userId }, { $set: { active } }, { new: true });
  if (!alert) throw ApiError.notFound('That alert does not exist.');
  return alert;
}
