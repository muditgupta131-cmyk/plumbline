import type { Model } from 'mongoose';
import { logger } from './logger.js';
import { User } from '../modules/auth/user.model.js';
import { Session } from '../modules/auth/session.model.js';
import { StockSymbol } from '../modules/market/symbol.model.js';
import { FundScheme } from '../modules/funds/fund.model.js';
import { Holding, Portfolio } from '../modules/portfolio/portfolio.model.js';
import { Transaction } from '../modules/portfolio/transaction.model.js';
import { AiReport } from '../modules/ai/analysis.model.js';
import { PortfolioReport } from '../modules/ai/portfolioReport.model.js';
import { BrokerConnection } from '../modules/broker/broker.model.js';
import { Alert, WatchlistItem } from '../modules/watchlist/watchlist.model.js';
import { Notification } from '../modules/watchlist/notification.model.js';

/**
 * Mongoose only builds indexes automatically when `autoIndex` is on, and that is deliberately
 * off in production. Without this step a deployment runs with no compound indexes and — worse —
 * no TTL indexes, so cached reports and notifications would never expire.
 */
export async function ensureIndexes(): Promise<number> {
  const models: Array<Model<never>> = [
    User,
    Session,
    StockSymbol,
    FundScheme,
    Portfolio,
    Holding,
    Transaction,
    AiReport,
    PortfolioReport,
    BrokerConnection,
    WatchlistItem,
    Alert,
    Notification,
  ] as unknown as Array<Model<never>>;

  let built = 0;

  for (const model of models) {
    try {
      await model.createIndexes();
      built += 1;
    } catch (error) {
      logger.warn('Could not build indexes', {
        model: model.modelName,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return built;
}
