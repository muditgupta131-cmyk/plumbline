import mongoose from 'mongoose';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
if (!isProduction) {
  mongoose.set('debug', false);
}

export async function connectDatabase(): Promise<boolean> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      autoIndex: !isProduction,
    });
    logger.info('MongoDB connected', { host: mongoose.connection.host });
  } catch (error) {
    const message = (error as Error).message;
    logger.error('MongoDB connection failed', { error: message });

    if (isProduction) throw error;

    logger.warn(
      'Starting without a database. Auth and saved data are unavailable; market data still works. Set MONGODB_URI in server/.env to enable them.',
    );
    return false;
  }

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  return true;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
