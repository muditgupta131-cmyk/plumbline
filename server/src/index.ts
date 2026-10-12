import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { ensureIndexes } from './config/indexes.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { seedSymbolUniverse } from './modules/market/symbol.service.js';
import { refreshFundUniverse } from './modules/funds/amfi.service.js';
import { startAlertScheduler } from './modules/watchlist/alerts.service.js';

let server: Server | undefined;

async function bootstrap(): Promise<void> {
  const databaseReady = await connectDatabase();

  if (databaseReady) {
    await ensureIndexes()
      .then((count) => logger.info('Indexes ready', { models: count }))
      .catch((error: Error) => logger.warn('Index creation skipped', { error: error.message }));

    seedSymbolUniverse()
      .then((count) => logger.info('Symbol universe ready', { seeded: count }))
      .catch((error: Error) => logger.warn('Symbol seeding skipped', { error: error.message }));

    startAlertScheduler();

    refreshFundUniverse()
      .then((count) => (count ? logger.info('Mutual fund universe ready', { schemes: count }) : undefined))
      .catch((error: Error) => logger.warn('Fund universe refresh skipped', { error: error.message }));
  }

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info('Plumbline API listening', { port: env.PORT, env: env.NODE_ENV });
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutting down', { signal });

  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();

  server?.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

bootstrap().catch((error: Error) => {
  logger.error('Startup failed', { error: error.message });
  process.exit(1);
});
