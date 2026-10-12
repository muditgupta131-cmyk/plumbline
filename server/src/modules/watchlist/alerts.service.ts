import type { Types } from 'mongoose';
import { isDatabaseConnected } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { securityKey, type SecurityRef } from '../../types/market.js';
import { getQuotes } from '../market/market.service.js';
import { getFunds } from '../funds/fund.service.js';
import { Alert, type AlertDocument } from './watchlist.model.js';
import { Notification } from './notification.model.js';

const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface EvaluationSummary {
  checked: number;
  priced: number;
  triggered: number;
  skippedInCooldown: number;
}

function identityKey(alert: AlertDocument): string {
  return alert.assetType === 'MUTUAL_FUND'
    ? `MF:${alert.schemeCode}`
    : `${alert.exchange}:${alert.symbol.toUpperCase()}`;
}

function crossed(alert: AlertDocument, price: number, changePercent: number | null): boolean {
  if (alert.type === 'PRICE_ABOVE') return price >= alert.threshold;
  if (alert.type === 'PRICE_BELOW') return price <= alert.threshold;
  return changePercent !== null && Math.abs(changePercent) >= alert.threshold;
}

function describe(alert: AlertDocument, price: number, changePercent: number | null): { title: string; body: string } {
  const money = alert.assetType === 'MUTUAL_FUND' || alert.exchange === 'NSE' || alert.exchange === 'BSE' ? '₹' : '$';
  const priced = `${money}${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  if (alert.type === 'PRICE_ABOVE') {
    return {
      title: `${alert.symbol} rose above ${money}${alert.threshold}`,
      body: `${alert.name} is trading at ${priced}, above the ${money}${alert.threshold} level you set.`,
    };
  }

  if (alert.type === 'PRICE_BELOW') {
    return {
      title: `${alert.symbol} fell below ${money}${alert.threshold}`,
      body: `${alert.name} is trading at ${priced}, below the ${money}${alert.threshold} level you set.`,
    };
  }

  return {
    title: `${alert.symbol} moved ${changePercent?.toFixed(2)}% today`,
    body: `${alert.name} is at ${priced}, a move of ${changePercent?.toFixed(2)}% against your ${alert.threshold}% threshold.`,
  };
}

export async function evaluateAlerts(userId?: Types.ObjectId): Promise<EvaluationSummary> {
  if (!isDatabaseConnected()) return { checked: 0, priced: 0, triggered: 0, skippedInCooldown: 0 };

  const alerts = await Alert.find({ active: true, ...(userId ? { userId } : {}) });
  if (!alerts.length) return { checked: 0, priced: 0, triggered: 0, skippedInCooldown: 0 };

  const now = Date.now();
  const due = alerts.filter((alert) => !alert.lastTriggeredAt || now - alert.lastTriggeredAt.getTime() > COOLDOWN_MS);
  const skippedInCooldown = alerts.length - due.length;
  if (!due.length) return { checked: alerts.length, priced: 0, triggered: 0, skippedInCooldown };

  const refs = new Map<string, SecurityRef>();
  const schemeCodes = new Set<string>();

  for (const alert of due) {
    if (alert.assetType === 'MUTUAL_FUND' && alert.schemeCode) schemeCodes.add(alert.schemeCode);
    else if (alert.exchange) refs.set(identityKey(alert), { symbol: alert.symbol, exchange: alert.exchange });
  }

  const [{ quotes }, schemes] = await Promise.all([
    refs.size ? getQuotes([...refs.values()]) : Promise.resolve({ quotes: [], failed: [] }),
    schemeCodes.size ? getFunds([...schemeCodes]) : Promise.resolve(new Map()),
  ]);

  const quoteMap = new Map(quotes.map((quote) => [securityKey(quote), quote]));
  const notifications: Array<Record<string, unknown>> = [];
  const triggeredIds: Types.ObjectId[] = [];
  let priced = 0;

  for (const alert of due) {
    const key = identityKey(alert);
    const quote = alert.assetType === 'MUTUAL_FUND' ? undefined : quoteMap.get(key);
    const scheme = alert.assetType === 'MUTUAL_FUND' ? schemes.get(alert.schemeCode ?? '') : undefined;

    const price = quote?.price ?? scheme?.nav ?? null;
    if (price === null) continue;
    priced += 1;

    const changePercent = quote?.changePercent ?? null;
    if (!crossed(alert, price, changePercent)) continue;

    const { title, body } = describe(alert, price, changePercent);

    notifications.push({
      userId: alert.userId,
      kind: 'ALERT',
      title,
      body,
      meta: {
        alertId: alert._id.toString(),
        symbol: alert.symbol,
        exchange: alert.exchange,
        schemeCode: alert.schemeCode,
        assetType: alert.assetType,
        price,
        threshold: alert.threshold,
        type: alert.type,
      },
      expiresAt: new Date(now + NOTIFICATION_TTL_MS),
    });

    alert.lastTriggeredAt = new Date(now);
    alert.lastValue = price;
    alert.triggerCount += 1;
    triggeredIds.push(alert._id);
    await alert.save();
  }

  if (notifications.length) await Notification.insertMany(notifications);

  return { checked: alerts.length, priced, triggered: triggeredIds.length, skippedInCooldown };
}

export async function listNotifications(userId: Types.ObjectId, limit = 50) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit);
}

export async function unreadCount(userId: Types.ObjectId): Promise<number> {
  return Notification.countDocuments({ userId, readAt: { $exists: false } });
}

export async function markRead(userId: Types.ObjectId, notificationId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) throw ApiError.notFound('That notification does not exist.');
  return notification;
}

export async function markAllRead(userId: Types.ObjectId): Promise<number> {
  const result = await Notification.updateMany(
    { userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}

let timer: NodeJS.Timeout | undefined;

export function startAlertScheduler(intervalMs = 5 * 60_000): void {
  if (timer) return;

  timer = setInterval(() => {
    evaluateAlerts()
      .then((summary) => {
        if (summary.triggered) logger.info('Alerts triggered', { ...summary });
      })
      .catch((error: Error) => logger.warn('Alert evaluation failed', { error: error.message }));
  }, intervalMs);

  timer.unref();
}

export function stopAlertScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
